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
  const [localEdits, setLocalEdits] = useState({});
  const [reqIdEdits, setReqIdEdits] = useState({});
  const [filters, setFilters] = useState({
    requirementId: "",
    client: "",
    title: "",
    status: "",
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  useEffect(() => {
    fetchRows();

    socket.on("requisitions_updated", (data) => setRows(data));

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

  // Update local state immediately while typing
  const handleFieldChange = (requirementId, field, value) => {
    if (field === "requirementId") return;

    setRows(prev =>
      prev.map(r => (r.requirementId === requirementId ? { ...r, [field]: value } : r))
    );

    setLocalEdits(prev => ({
      ...prev,
      [requirementId]: { ...(prev[requirementId] || {}), [field]: value },
    }));

    broadcastEditing(requirementId, field, true);
  };

  // Save to backend only on blur
  const saveFieldOnBlur = async (requirementId, field, value) => {
    broadcastEditing(requirementId, field, false);
    try {
      await axios.put(`/api/requisitions/${requirementId}`, { [field]: value });
      setLocalEdits(prev => {
        const copy = { ...prev };
        if (copy[requirementId]) delete copy[requirementId][field];
        return copy;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
      fetchRows();
    }
  };

  const toggleWorking = async (row) => {
    if (row.status !== "Open" || row.slots <= 0) return;

    const assignedUsers = row.assigned_recruiters || [];
    const isAlreadyAssigned = assignedUsers.includes(currentUser);

    // Check if user is already working on another requirement
    const userWorkingElsewhere = rows.some(r =>
      r.requirementId !== row.requirementId && r.assigned_recruiters?.includes(currentUser)
    );
    if (!isAlreadyAssigned && userWorkingElsewhere) {
      alert("You can only work on one requirement at a time.");
      return;
    }

    if (!isAlreadyAssigned && assignedUsers.length >= 2) {
      alert("Maximum 2 users already working on this requirement.");
      return;
    }

    try {
      await axios.put(`/api/requisitions/${row.requirementId}`, {
        working: !isAlreadyAssigned,
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
      alert(err.response?.data?.message || "Add row failed");
    }
  };

  const isLockedByOther = (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    return assignedUsers.length >= 2 && !assignedUsers.includes(currentUser);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const filteredRows = rows.filter(row =>
    Object.entries(filters).every(([key, val]) =>
      row[key]?.toString().toLowerCase().includes(val.toLowerCase())
    )
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key]?.toString().toLowerCase() || "";
    const bVal = b[sortConfig.key]?.toString().toLowerCase() || "";
    return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
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
            <th>Assigned Recruiters</th>
            <th>Working</th>
          </tr>
          <tr>
            {["requirementId", "client", "title", "status"].map((key) => (
              <th key={key}>
                <input
                  placeholder={`Filter ${key}`}
                  value={filters[key]}
                  onChange={(e) =>
                    setFilters(prev => ({ ...prev, [key]: e.target.value }))
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
            const assignedUsers = row.assigned_recruiters || [];
            const workingTimes = row.working_times || {};

            return (
              <tr
                key={row.requirementId}
                className={`animated-row ${
                  locked
                    ? "locked"
                    : assignedUsers.includes(currentUser)
                    ? "working-current"
                    : ""
                }`}
              >
                {["requirementId", "client", "title", "status", "slots"].map((field) => {
                  const editingUser = editing[`${row.requirementId}::${field}`];
                  const isEditing = editingUser && editingUser !== currentUser;
                  const value = field === "slots" ? row.slots ?? 0 : row[field] ?? "";

                  if (field === "requirementId") {
                    return (
                      <td key={field}>
                        <div className="input-wrapper">
                          <input
                            type="text"
                            value={reqIdEdits[row.requirementId] ?? value}
                            disabled={locked}
                            onChange={(e) =>
                              setReqIdEdits(prev => ({
                                ...prev,
                                [row.requirementId]: e.target.value,
                              }))
                            }
                            onBlur={async () => {
                              const newValue = reqIdEdits[row.requirementId];
                              if (newValue && newValue !== row.requirementId) {
                                try {
                                  await axios.put(`/api/requisitions/${row.requirementId}`, { newRequirementId: newValue });
                                  setReqIdEdits(prev => {
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
                            <span className="editing-indicator" style={{ backgroundColor: generateColor(editingUser) }}>
                              Editing by {editingUser}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  }

                  return (
                    <td key={field}>
                      {field === "status" ? (
                        <select
                          value={value}
                          disabled={locked}
                          onChange={(e) => handleFieldChange(row.requirementId, field, e.target.value)}
                          onBlur={(e) => saveFieldOnBlur(row.requirementId, field, e.target.value)}
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
                            onChange={(e) => handleFieldChange(row.requirementId, field, e.target.value)}
                            onBlur={(e) => saveFieldOnBlur(row.requirementId, field, e.target.value)}
                            style={{ width: `${Math.max(value.toString().length, 4)}ch` }}
                          />
                          {isEditing && (
                            <span className="editing-indicator" style={{ backgroundColor: generateColor(editingUser) }}>
                              Editing by {editingUser}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  );
                })}

                <td>
                  {assignedUsers.length > 0
                    ? assignedUsers.map((user) => (
                        <div key={user}>
                          {user} {workingTimes[user] ? `(${new Date(workingTimes[user]).toLocaleTimeString()})` : ""}
                        </div>
                      ))
                    : row.status !== "Open" || row.slots <= 0
                    ? "Non-Workable"
                    : ""}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={assignedUsers.includes(currentUser)}
                    disabled={locked}
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
