import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./Table.css";

const socket = io("/");

const userColors = {};
const generateColor = (userName) => {
  if (!userColors[userName]) {
    const hue = Math.floor(Math.random() * 360);
    userColors[userName] = `hsl(${hue}, 70%, 85%)`;
  }
  return userColors[userName];
};

function Table({ currentUser }) {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const typingTimersRef = useRef({});
  const [localEdits, setLocalEdits] = useState({});
  const [reqIdEdits, setReqIdEdits] = useState({}); // <-- Local state for requirementId edits
  const [filters, setFilters] = useState({
    requirementId: "",
    client: "",
    title: "",
    status: "",
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    fetchRows();

    socket.on("requisitions_updated", (data) => {
      setRows(data);
    });

    socket.on("editing_status", ({ requirementId, field, userName, isEditing }) => {
      setEditing((prev) => ({
        ...prev,
        [`${requirementId}::${field}`]: isEditing ? userName : null,
      }));
    });

    return () => {
      socket.off("requisitions_updated");
      socket.off("editing_status");
    };
  }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const broadcastEditing = (requirementId, field, isEditing) => {
    socket.emit("editing_status", { requirementId, field, userName: currentUser, isEditing });
  };

  const handleFieldChange = (requirementId, field, value) => {
    if (field === "requirementId") return; // Skip requirementId here, handled separately

    setRows((prev) =>
      prev.map((r) => (r.requirementId === requirementId ? { ...r, [field]: value } : r))
    );

    setLocalEdits((prev) => ({
      ...prev,
      [requirementId]: { ...(prev[requirementId] || {}), [field]: value },
    }));

    broadcastEditing(requirementId, field, true);

    const key = `${requirementId}::${field}`;
    if (typingTimersRef.current[key]) clearTimeout(typingTimersRef.current[key]);

    typingTimersRef.current[key] = setTimeout(async () => {
      try {
        await axios.put(`/api/requisitions/${requirementId}`, { [field]: value });
        broadcastEditing(requirementId, field, false);
      } catch (err) {
        console.error("Update failed:", err);
        alert(err.response?.data?.message || "Update failed");
        fetchRows();
        broadcastEditing(requirementId, field, false);
      } finally {
        delete typingTimersRef.current[key];
      }
    }, 800);
  };

  const toggleWorking = async (row) => {
    if (row.status !== "Open" || row.slots <= 0) return;

    const alreadyWorking = rows.find(
      (r) => r.working && r.assignedRecruiter === currentUser && r.requirementId !== row.requirementId
    );

    if (!row.working && alreadyWorking) {
      alert(
        "You're already working on another requirement. Please free it to start working on this one."
      );
      return;
    }

    try {
      await axios.put(`/api/requisitions/${row.requirementId}`, {
        working: !row.working,
        userName: currentUser,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Working toggle failed");
      fetchRows();
    }
  };

  const addRow = async () => {
    const newReqId = `REQ-${Date.now()}`;
    try {
      await axios.post("/api/requisitions", {
        requirementId: newReqId,
        client: "",
        title: "",
        status: "Open",
        slots: 1,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Add row failed");
    }
  };

  const isLockedByOther = (row) =>
    row.working && row.assignedRecruiter && row.assignedRecruiter !== currentUser;

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      } else {
        return { key, direction: "asc" };
      }
    });
  };

  const filteredRows = rows.filter((row) =>
    Object.entries(filters).every(([key, val]) =>
      row[key].toString().toLowerCase().includes(val.toLowerCase())
    )
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key]?.toString().toLowerCase() || "";
    const bVal = b[sortConfig.key]?.toString().toLowerCase() || "";
    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="table-container">
      <div className="table-actions">
        <button onClick={addRow}>Add Row</button>
      </div>

      <table className="req-table">
        <thead>
          <tr>
            {["requirementId", "client", "title", "status"].map((key) => (
              <th key={key} onClick={() => handleSort(key)}>
                {key.charAt(0).toUpperCase() + key.slice(1)}{" "}
                {sortConfig.key === key ? (sortConfig.direction === "asc" ? "▲" : "▼") : ""}
              </th>
            ))}
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
          <tr>
            {["requirementId", "client", "title", "status"].map((key) => (
              <th key={key}>
                <input
                  placeholder={`Filter ${key}`}
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                />
              </th>
            ))}
            <th></th>
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const locked = isLockedByOther(row);

            return (
              <tr
                key={row.requirementId}
                className={`animated-row ${
                  locked
                    ? "locked"
                    : row.working && row.assignedRecruiter === currentUser
                    ? "working-current"
                    : ""
                }`}
              >
                {["requirementId", "client", "title", "status", "slots"].map((field) => {
                  const editingUser = editing[`${row.requirementId}::${field}`];
                  const isEditing = editingUser && editingUser !== currentUser;

                  const value =
                    field === "status"
                      ? row.status ?? "Open"
                      : field === "slots"
                      ? row.slots ?? 0
                      : row[field] ?? "";

                  // ----------- Updated requirementId input -------------
                  if (field === "requirementId") {
                    return (
                      <td key={field}>
                        <div className="input-wrapper">
                          <input
                            type="text"
                            value={reqIdEdits[row.requirementId] ?? value}
                            disabled={locked}
                            onChange={(e) =>
                              setReqIdEdits((prev) => ({
                                ...prev,
                                [row.requirementId]: e.target.value,
                              }))
                            }
                            onBlur={async () => {
                              const newValue = reqIdEdits[row.requirementId];
                              if (newValue && newValue !== row.requirementId) {
                                try {
                                  await axios.put(
                                    `/api/requisitions/${row.requirementId}`,
                                    { newRequirementId: newValue }
                                  );
                                  setReqIdEdits((prev) => {
                                    const copy = { ...prev };
                                    delete copy[row.requirementId];
                                    return copy;
                                  });
                                } catch (err) {
                                  alert(err.response?.data?.message || "Update failed");
                                  fetchRows();
                                }
                              }
                            }}
                            style={{ width: `${Math.max(value.length, 4)}ch` }}
                          />
                          {isEditing && (
                            <span
                              className="editing-indicator"
                              style={{ backgroundColor: generateColor(editingUser) }}
                            >
                              Editing by {editingUser}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  // ----------- Other fields (existing logic) -------------
                  return (
                    <td key={field}>
                      {field === "status" ? (
                        <select
                          value={value}
                          disabled={locked}
                          onChange={(e) =>
                            handleFieldChange(row.requirementId, field, e.target.value)
                          }
                        >
                          <option value="Open">Open</option>
                          <option value="On Hold">On Hold</option>
                          <option value="Closed">Closed</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Filled">Filled</option>
                        </select>
                      ) : (
                        <div className="input-wrapper">
                          <input
                            type={field === "slots" ? "number" : "text"}
                            value={value}
                            disabled={locked}
                            onChange={(e) => {
                              if (field === "slots") {
                                const newValue = Number(e.target.value);
                                if (
                                  row.working &&
                                  row.assignedRecruiter === currentUser &&
                                  newValue === 0
                                ) {
                                  alert(
                                    "Cannot set Slots to 0 while you are working on this requirement."
                                  );
                                  return;
                                }
                                handleFieldChange(row.requirementId, field, newValue);
                              } else {
                                handleFieldChange(row.requirementId, field, e.target.value);
                              }
                            }}
                            style={
                              field === "client" || field === "title"
                                ? { width: `${Math.max(value.length, 4)}ch` }
                                : {}
                            }
                          />
                          {isEditing && (
                            <span
                              className="editing-indicator"
                              style={{ backgroundColor: generateColor(editingUser) }}
                            >
                              Editing by {editingUser}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}

                <td>
                  {row.working
                    ? row.assignedRecruiter || ""
                    : row.status !== "Open" || row.slots <= 0
                    ? "Non-Workable"
                    : ""}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(row.working && row.assignedRecruiter === currentUser)}
                    disabled={
                      row.status !== "Open" ||
                      row.slots <= 0 ||
                      (row.working && row.assignedRecruiter !== currentUser)
                    }
                    onChange={() => toggleWorking(row)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
