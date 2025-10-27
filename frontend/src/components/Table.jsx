// frontend/src/components/Table.jsx
import React, {
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
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

  // Column widths & refs (for resizing)
  const [colWidths, setColWidths] = useState({});
  const thRefs = useRef({});

  // === Init username ===
  useEffect(() => {
    let user = localStorage.getItem("recruiterName");
    if (!user) {
      user = prompt("Enter your name:");
      if (user) localStorage.setItem("recruiterName", user);
    }
    setCurrentUser(user || "Anonymous");
  }, []);

  // === Fetch rows ===
  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data || []);
    } catch (err) {
      console.error("Error fetching requisitions:", err);
    }
  };

  useImperativeHandle(ref, () => ({ fetchRows }));

  useEffect(() => {
    fetchRows();
    socket.on("requisitions_updated", fetchRows);
    socket.on("editing_status", (data) => {
      // data = { requirementid, field, user }
      setEditingStatus((prev) => ({
        ...prev,
        [data.requirementid]: data.user ? { user: data.user, field: data.field } : null,
      }));
    });
    return () => {
      socket.off("requisitions_updated");
      socket.off("editing_status");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // === Editing local state ===
  const handleEdit = (reqId, field, value) => {
    setEditing((prev) => ({
      ...prev,
      [reqId]: { ...prev[reqId], [field]: value },
    }));
  };

  // Save: send patched fields to backend
  const handleSave = async (reqId) => {
    const updatedFields = editing[reqId];
    if (!updatedFields) return;

    try {
      await axios.put(`/api/requisitions/${reqId}`, updatedFields);
      socket.emit("requisitions_updated");
      // clear editing cache for that row
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    } catch (err) {
      // show single alert and refresh rows to revert UI to server state
      const msg = err.response?.data?.message || "Error saving changes";
      alert(msg);
      await fetchRows();
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    }
  };

  // === Toggle working checkbox ===
  const toggleWorking = async (row) => {
    if (!row.requirementid) return;

    const assignedUsers = row.assigned_recruiters || [];
    const isAssigned = assignedUsers.includes(currentUser);

    // one active row per user
    const alreadyWorking = rows.find(
      (r) =>
        (r.assigned_recruiters || []).includes(currentUser) &&
        r.requirementid !== row.requirementid
    );
    if (!isAssigned && alreadyWorking) {
      alert("You are already working on another requirement. Please uncheck it first.");
      return;
    }

    // max two users
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
      (r) =>
        (r.assigned_recruiters || []).includes(currentUser) &&
        r.requirementid !== row.requirementid
    );
    return (
      nonWorkable ||
      (!assignedUsers.includes(currentUser) &&
        (assignedUsers.length >= 2 || userWorkingElsewhere))
    );
  };

  // === Sorting & filtering ===
  const handleSort = (field) => {
    let direction = "ascending";
    if (sortConfig.field === field && sortConfig.direction === "ascending") {
      direction = "descending";
    }
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
    // for arrays (assigned_recruiters) compare joined string
    const getVal = (obj, f) =>
      Array.isArray(obj[f]) ? (obj[f] || []).join(", ") : obj[f] ?? "";
    const valA = String(getVal(a, sortConfig.field)).toLowerCase();
    const valB = String(getVal(b, sortConfig.field)).toLowerCase();
    if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
    return 0;
  });

  // === Pagination ===
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // === Column resize handlers ===
  const startResize = (e, col) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = thRefs.current[col]?.offsetWidth || 100;

    const doDrag = (event) => {
      const newWidth = Math.max(40, startWidth + event.clientX - startX);
      setColWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
    };

    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  // Helper: revert a field immediately in the UI (without saving)
  const revertFieldImmediate = (row, field) => {
    // clear any local editing for that row->field to show server value
    setEditing((prev) => {
      const copy = { ...prev };
      if (!copy[row.requirementid]) return copy;
      delete copy[row.requirementid][field];
      // if no other fields left, remove the object
      if (Object.keys(copy[row.requirementid] || {}).length === 0) delete copy[row.requirementid];
      return copy;
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-center mb-4">
        <h2 className="font-bold text-lg">Requirements List</h2>
      </div>

      {/* Filters row locked under headers and sized */}
      <div className="table-wrapper">
        <div className="filters-row-outer">
          {columns
            .filter((c) => c !== "working")
            .map((col) => (
              <div
                key={col}
                className="filter-cell"
                style={{ width: colWidths[col] || undefined }}
              >
                <input
                  placeholder="Filter..."
                  className="filter-input"
                  value={filters[col] ?? ""}
                  onChange={(e) => handleFilter(col, e.target.value)}
                />
              </div>
            ))}
          {/* a placeholder div for working col filter spacing */}
          <div className="filter-cell" style={{ width: colWidths.working || undefined }} />
        </div>

        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead className="bg-gray-100 sticky-header">
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

                  <div className="resize-handle" onMouseDown={(e) => startResize(e, col)} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.map((row) => {
              const assignedUsers = row.assigned_recruiters || [];
              const nonWorkable = isNonWorkable(row);
              const editingUser = editingStatus[row.requirementid];

              // helper to get displayed value (local editing overrides server)
              const displayVal = (r, field) =>
                editing[r]?.[field] !== undefined ? editing[r][field] : rows.find((x) => x.requirementid === row.requirementid)?.[field];

              return (
                <tr key={row.requirementid}>
                  {/* Req ID */}
                  <td className="border p-1 text-center">
                    <input
                      type="text"
                      className="w-full text-center border rounded"
                      value={
                        editing[row.requirementid]?.requirementid ?? row.requirementid ?? ""
                      }
                      onFocus={() =>
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "requirementid",
                          user: currentUser,
                        })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "requirementid",
                          user: null,
                        });
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
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "title",
                          user: currentUser,
                        })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "title",
                          user: null,
                        });
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
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "client",
                          user: currentUser,
                        })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "client",
                          user: null,
                        });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => handleEdit(row.requirementid, "client", e.target.value)}
                    />
                    {editingUser?.field === "client" && editingUser?.user !== currentUser && (
                      <span className="text-xs text-blue-600">{editingUser.user} is editing...</span>
                    )}
                  </td>

                  {/* Slots (editable even when 0) */}
                  <td className="border p-1 text-center">
                    <input
                      type="number"
                      min="0"
                      value={editing[row.requirementid]?.slots ?? row.slots ?? 0}
                      onFocus={() =>
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "slots",
                          user: currentUser,
                        })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "slots",
                          user: null,
                        });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => {
                        // if this user is assigned -> block and revert immediately (no loops)
                        if (assignedUsers.includes(currentUser)) {
                          // revert UI immediately to server value
                          revertFieldImmediate(row, "slots");
                          // inform user once
                          alert("Cannot change Slots while working on this requirement.");
                          return;
                        }
                        // also prevent negative values
                        const val = Number(e.target.value);
                        handleEdit(row.requirementid, "slots", Number.isNaN(val) ? 0 : val);
                      }}
                      className="w-16 text-center"
                      style={{ width: colWidths.slots || undefined }}
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
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "status",
                          user: currentUser,
                        })
                      }
                      onBlur={() => {
                        socket.emit("editing_status", {
                          requirementid: row.requirementid,
                          field: "status",
                          user: null,
                        });
                        handleSave(row.requirementid);
                      }}
                      onChange={(e) => {
                        if (assignedUsers.includes(currentUser)) {
                          revertFieldImmediate(row, "status");
                          alert("Cannot change Status while working on this requirement.");
                          return;
                        }
                        handleEdit(row.requirementid, "status", e.target.value);
                      }}
                      className="border p-1"
                      style={{ width: colWidths.status || undefined }}
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
                            ? new Date(time).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : null;
                          return (
                            <div key={user} className="flex gap-2 items-center text-xs">
                              <span className={user === currentUser ? "font-semibold text-green-700" : ""}>
                                {user}
                              </span>
                              {formattedTime && <span className="text-gray-500">({formattedTime})</span>}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Working Checkbox */}
                  <td className="border p-1 text-center">
                    <input
                      type="checkbox"
                      checked={assignedUsers.includes(currentUser)}
                      onChange={() => toggleWorking(row)}
                      disabled={disableCheckbox(row)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-2">
          <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="border px-2 py-1 rounded disabled:opacity-50">
            Prev
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              className={`border px-2 py-1 rounded ${currentPage === i + 1 ? "bg-gray-300" : ""}`}
              onClick={() => setCurrentPage(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="border px-2 py-1 rounded disabled:opacity-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
});

export default Table;
