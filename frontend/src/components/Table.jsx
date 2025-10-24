// frontend/src/components/Table.jsx
import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./Table.css";

const socket = io(window.location.origin);

const Table = forwardRef((props, ref) => {
  const [rows, setRows] = useState([]);
  const [editing, setEditing] = useState({});
  const [currentUser, setCurrentUser] = useState("");
  const [editingStatus, setEditingStatus] = useState({});
  const [sortConfig, setSortConfig] = useState({});
  const [filters, setFilters] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const [colWidths, setColWidths] = useState({});
  const thRefs = useRef({});

  useEffect(() => {
    let user = localStorage.getItem("recruiterName");
    if (!user) {
      user = prompt("Enter your name:");
      if (user) localStorage.setItem("recruiterName", user);
    }
    setCurrentUser(user || "Anonymous");
  }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useImperativeHandle(ref, () => ({ fetchRows }));

  useEffect(() => {
    fetchRows();
    socket.on("requisitions_updated", fetchRows);
    socket.on("editing_status", (data) => {
      setEditingStatus((prev) => ({
        ...prev,
        [data.requirementid]: data.user ? { user: data.user, field: data.field } : null,
      }));
    });
    return () => {
      socket.off("requisitions_updated");
      socket.off("editing_status");
    };
  }, []);

  const columns = [
    "requirementid",
    "title",
    "client",
    "slots",
    "status",
    "assigned_recruiters",
    "working",
  ];

  const isNonWorkable = (row) => row.status !== "Open" || row.slots === 0;

  const handleEdit = (reqId, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [reqId]: { ...prev[reqId], [field]: value },
    }));
  };

  const handleSave = async (reqId) => {
    const updatedFields = editing[reqId];
    if (!updatedFields) return;

    try {
      await axios.put(`/api/requisitions/${reqId}`, updatedFields);
      socket.emit("requisitions_updated");
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving changes");
    }
  };

  const toggleWorking = async (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const isAssigned = assignedUsers.includes(currentUser);

    const alreadyWorking = rows.find(
      (r) => (r.assigned_recruiters || []).includes(currentUser) && r.requirementid !== row.requirementid
    );
    if (!isAssigned && alreadyWorking) {
      alert("You are already working on another requirement. Please uncheck it first.");
      return;
    }

    if (!isAssigned && assignedUsers.length >= 2) {
      alert("Two recruiters are already working on this requirement.");
      return;
    }

    const newAssigned = isAssigned
      ? assignedUsers.filter((u) => u !== currentUser)
      : [...assignedUsers, currentUser];

    const newWorkingTimes = { ...(row.working_times || {}) };
    if (isAssigned) delete newWorkingTimes[currentUser];
    else newWorkingTimes[currentUser] = new Date();

    try {
      await axios.put(`/api/requisitions/${row.requirementid}`, {
        assigned_recruiters: newAssigned,
        working_times: newWorkingTimes,
      });
      socket.emit("requisitions_updated");
      fetchRows();
    } catch (err) {
      alert(err.response?.data?.message || "Error updating working status");
    }
  };

  const disableCheckbox = (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const nonWorkable = isNonWorkable(row);
    const userWorkingElsewhere = rows.some(
      (r) => (r.assigned_recruiters || []).includes(currentUser) && r.requirementid !== row.requirementid
    );
    return (
      nonWorkable ||
      (!assignedUsers.includes(currentUser) && (assignedUsers.length >= 2 || userWorkingElsewhere))
    );
  };

  const handleSort = (field) => {
    let direction = "ascending";
    if (sortConfig.field === field && sortConfig.direction === "ascending") direction = "descending";
    setSortConfig({ field, direction });
  };

  const handleFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const filteredRows = rows.filter((row) =>
    Object.keys(filters).every((field) => {
      const filterValue = filters[field]?.toLowerCase();
      if (!filterValue) return true;
      if (field === "assigned_recruiters") {
        return (row[field] || []).some((u) => u.toLowerCase().includes(filterValue));
      }
      return String(row[field] ?? "").toLowerCase().includes(filterValue);
    })
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.field) return 0;
    const valA = a[sortConfig.field] ?? "";
    const valB = b[sortConfig.field] ?? "";
    if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const startResize = (e, col) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = thRefs.current[col]?.offsetWidth || 100;

    const doDrag = (event) => {
      const newWidth = startWidth + event.clientX - startX;
      setColWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  return (
    <div className="p-4">
      <div className="flex justify-center mb-4">
        <h2 className="font-bold text-lg">Requirements List</h2>
      </div>

      <div className="table-wrapper">
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead className="bg-gray-100 sticky-header">
            {/* Column Headers */}
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  ref={(el) => (thRefs.current[col] = el)}
                  className="border p-1 cursor-pointer"
                  onClick={() => handleSort(col)}
                  style={{ width: colWidths[col] }}
                >
                  <div className="th-content">
                    <span>
                      {col === "requirementid" && "Req ID"}
                      {col === "title" && "Job Title"}
                      {col === "client" && "Client"}
                      {col === "slots" && "Slots"}
                      {col === "status" && "Status"}
                      {col === "assigned_recruiters" && "Assigned Recruiter(s)"}
                      {col === "working" && "Working?"}
                    </span>
                    {sortConfig.field === col && (
                      <span>{sortConfig.direction === "ascending" ? "▲" : "▼"}</span>
                    )}
                  </div>
                  <div className="resize-handle" onMouseDown={(e) => startResize(e, col)}></div>
                </th>
              ))}
            </tr>

            {/* Filter Row */}
            <tr className="filters-row">
              {columns.map((col) => (
                <th key={col} className="border p-1">
                  {col !== "working" && (
                    <input
                      placeholder="Filter..."
                      className="filter-input"
                      value={filters[col] ?? ""}
                      onChange={(e) => handleFilter(col, e.target.value)}
                      style={{ width: "100%" }}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.map((row) => {
              const assignedUsers = row.assigned_recruiters || [];
              const nonWorkable = isNonWorkable(row);
              const editingUser = editingStatus[row.requirementid];

              return (
                <tr key={row.requirementid}>
                  {/* Req ID */}
                  <td className="border p-1 text-center">
                    <input
                      type="text"
                      className="w-full text-center border rounded"
                      value={editing[row.requirementid]?.requirementid ?? row.requirementid ?? ""}
                      onFocus={() =>
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "requirementid", user: currentUser })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "requirementid", user: null });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => handleEdit(row.requirementid, "requirementid", e.target.value)}
                    />
                    {editingUser?.field === "requirementid" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Job Title */}
                  <td className="border p-1">
                    <input
                      className="w-full"
                      value={editing[row.requirementid]?.title ?? row.title ?? ""}
                      onFocus={() =>
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "title", user: currentUser })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "title", user: null });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => handleEdit(row.requirementid, "title", e.target.value)}
                    />
                    {editingUser?.field === "title" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Client */}
                  <td className="border p-1">
                    <input
                      className="w-full"
                      value={editing[row.requirementid]?.client ?? row.client ?? ""}
                      onFocus={() =>
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "client", user: currentUser })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "client", user: null });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => handleEdit(row.requirementid, "client", e.target.value)}
                    />
                    {editingUser?.field === "client" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Slots */}
                  <td className="border p-1 text-center">
                    <input
                      type="number"
                      min="0"
                      value={editing[row.requirementid]?.slots ?? row.slots ?? 0}
                      onFocus={() =>
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "slots", user: currentUser })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "slots", user: null });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => {
                        if (assignedUsers.includes(currentUser)) {
                          alert("Cannot change Slots while working on this requirement.");
                          handleEdit(row.requirementid, "slots", row.slots);
                          return;
                        }
                        handleEdit(row.requirementid, "slots", Number(e.target.value));
                      }}
                      className="w-16 text-center"
                    />
                    {editingUser?.field === "slots" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="border p-1 text-center">
                    <select
                      value={editing[row.requirementid]?.status ?? row.status ?? ""}
                      onFocus={() =>
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "status", user: currentUser })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", { requirementid: row.requirementid, field: "status", user: null });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => {
                        if (assignedUsers.includes(currentUser)) {
                          alert("Cannot change Status while working on this requirement.");
                          handleEdit(row.requirementid, "status", "Open");
                          return;
                        }
                        handleEdit(row.requirementid, "status", e.target.value);
                      }}
                      className="border p-1"
                    >
                      <option>Open</option>
                      <option>Closed</option>
                      <option>Filled</option>
                      <option>On Hold</option>
                      <option>Cancelled</option>
                    </select>
                    {editingUser?.field === "status" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Assigned Recruiters */}
                  <td className="border p-1 text-center">
                    {nonWorkable ? (
                      "Non-Workable"
                    ) : assignedUsers.length ? (
                      <div className="flex flex-col items-start">
                        {assignedUsers.map((user) => {
                          const time = row.working_times?.[user];
                          const formattedTime = time
                            ? new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : null;
                          return (
                            <div key={user} className="flex gap-2 items-center text-xs">
                              <span className={user === currentUser ? "font-semibold text-green-700" : ""}>{user}</span>
                              {formattedTime && <span className="text-gray-500">({formattedTime})</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Working */}
                  <td className="border p-1 text-center">
                    <input type="checkbox" checked={assignedUsers.includes(currentUser)} onChange={() => toggleWorking(row)} disabled={disableCheckbox(row)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default Table;
