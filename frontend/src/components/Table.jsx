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
  const [colWidths, setColWidths] = useState({
    requirementid: 150,
    title: 250,
    client: 120,
    slots: 60,
    status: 100,
    assigned_recruiters: 140,
    working: 100,
  });
  const thRefs = useRef({});

  // Load user
  useEffect(() => {
    let user = localStorage.getItem("recruiterName");
    if (!user) {
      user = prompt("Enter your name:");
      if (user) localStorage.setItem("recruiterName", user);
    }
    setCurrentUser(user || "Anonymous");
  }, []);

  // Fetch all rows
  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data || []);
    } catch (err) {
      console.error("Error fetching requisitions:", err);
    }
  };

  useImperativeHandle(ref, () => ({ fetchRows }));

  // Socket listeners
  useEffect(() => {
    fetchRows();

    // Editing indicators
    socket.on("editing_status", (data) => {
      setEditingStatus((prev) => {
        const updated = { ...prev };
        const { requirementid, user, field } = data;
        if (!user || !field) delete updated[requirementid];
        else updated[requirementid] = { user, field };
        return updated;
      });
    });

    // Real-time updates (edit/new row)
    socket.on("requisitions_updated", (updatedRow) => {
      if (!updatedRow) return;
      setRows((prev) => {
        const exists = prev.find(
          (r) => r.requirementid === updatedRow.requirementid
        );
        if (exists) {
          // update row in place
          return prev.map((r) =>
            r.requirementid === updatedRow.requirementid
              ? { ...r, ...updatedRow }
              : r
          );
        } else {
          // new row added
          return [...prev, updatedRow];
        }
      });
    });

    return () => {
      socket.off("editing_status");
      socket.off("requisitions_updated");
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

  // Editing
  const handleEdit = (reqId, field, value) => {
    socket.emit("editing_status", { requirementid: reqId, user: currentUser, field });
    setEditing((prev) => ({
      ...prev,
      [reqId]: { ...prev[reqId], [field]: value },
    }));
  };

  // Save on blur
  const handleSave = async (reqId) => {
    const updatedFields = editing[reqId];
    if (!updatedFields) return;

    const cleanedFields = Object.fromEntries(
      Object.entries(updatedFields).filter(
        ([, val]) => val !== undefined && val !== null && val !== ""
      )
    );

    try {
      const res = await axios.put(`/api/requisitions/${reqId}`, cleanedFields);
      const updatedRow = res.data;

      // ✅ Immediately update local UI
      setRows((prevRows) =>
        prevRows.map((r) =>
          r.requirementid === reqId ? { ...r, ...updatedRow } : r
        )
      );

      // ✅ Notify everyone in real-time
      socket.emit("requisitions_updated", updatedRow);
      socket.emit("editing_status", { requirementid: reqId, user: null, field: null });

      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving changes");
      socket.emit("editing_status", { requirementid: reqId, user: null, field: null });
    }
  };

  // ==============================
  // Toggle working checkbox (auto-switch behavior)
  // ==============================
  const toggleWorking = async (row) => {
    if (!row.requirementid) return;

    const assignedUsers = row.assigned_recruiters || [];
    const isAssigned = assignedUsers.includes(currentUser);

    // Guard: don't allow adding a 3rd recruiter to a row the user isn't already on
    if (!isAssigned && assignedUsers.length >= 2) {
      alert("Two recruiters are already working on this requirement.");
      return;
    }

    // Find if the user is already working on a different row
    const alreadyWorking = rows.find(
      (r) =>
        (r.assigned_recruiters || []).includes(currentUser) &&
        r.requirementid !== row.requirementid
    );

    try {
      // If user is switching to a new row, unassign from old one first
      if (!isAssigned && alreadyWorking) {
        const oldAssigned = (alreadyWorking.assigned_recruiters || []).filter(
          (u) => u !== currentUser
        );
        const oldWorkingTimes = { ...(alreadyWorking.working_times || {}) };
        delete oldWorkingTimes[currentUser];

        // Persist removal on old row
        const oldRes = await axios.put(
          `/api/requisitions/${alreadyWorking.requirementid}`,
          {
            assigned_recruiters: oldAssigned,
            working_times: oldWorkingTimes,
          }
        );

        const oldUpdatedRow = oldRes.data || {
          ...alreadyWorking,
          assigned_recruiters: oldAssigned,
          working_times: oldWorkingTimes,
        };

        // Update UI locally and broadcast
        setRows((prev) =>
          prev.map((r) =>
            r.requirementid === alreadyWorking.requirementid
              ? { ...r, ...oldUpdatedRow }
              : r
          )
        );
        socket.emit("requisitions_updated", oldUpdatedRow);
      }

      // Now toggle for the clicked row
      const newAssigned = isAssigned
        ? assignedUsers.filter((u) => u !== currentUser)
        : [...assignedUsers, currentUser];

      const newWorkingTimes = { ...(row.working_times || {}) };
      if (isAssigned) delete newWorkingTimes[currentUser];
      else newWorkingTimes[currentUser] = new Date();

      const res = await axios.put(`/api/requisitions/${row.requirementid}`, {
        assigned_recruiters: newAssigned,
        working_times: newWorkingTimes,
      });

      const updatedRow = res.data;
      setRows((prev) =>
        prev.map((r) =>
          r.requirementid === row.requirementid ? { ...r, ...updatedRow } : r
        )
      );
      socket.emit("requisitions_updated", updatedRow);
    } catch (err) {
      alert(err.response?.data?.message || "Error updating working status");
    }
  };

  // ==============================
  // Checkbox disabling: only for non-workable or full rows
  // ==============================
  const disableCheckbox = (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const nonWorkable = isNonWorkable(row);
    // allow unchecking even if at limit by letting assigned users interact
    return nonWorkable || (assignedUsers.length >= 2 && !assignedUsers.includes(currentUser));
  };

  // Sorting and filtering
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
        return (row[field] || []).some((u) =>
          u.toLowerCase().includes(filterValue)
        );
      }
      return String(row[field] ?? "").toLowerCase().includes(filterValue);
    })
  );

  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.field) return 0;
    const getVal = (obj, f) =>
      Array.isArray(obj[f]) ? (obj[f] || []).join(", ") : obj[f] ?? "";
    const valA = String(getVal(a, sortConfig.field)).toLowerCase();
    const valB = String(getVal(b, sortConfig.field)).toLowerCase();
    if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
    if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);
  const paginatedRows = sortedRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  // Column resize
  const startResize = (e, col) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = thRefs.current[col]?.offsetWidth || 100;
    document.body.classList.add("resizing");
    const doDrag = (event) => {
      const newWidth = Math.max(60, startWidth + event.clientX - startX);
      setColWidths((prev) => ({ ...prev, [col]: newWidth }));
    };
    const stopDrag = () => {
      document.removeEventListener("mousemove", doDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.body.classList.remove("resizing");
    };
    document.addEventListener("mousemove", doDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const formatTime = (timeString) => {
    if (!timeString) return "";
    const date = new Date(timeString);
    if (isNaN(date)) return "";
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // ===== JSX =====
  return (
    <div className="p-4">
      <div className="flex justify-center mb-4">
        <h2 className="font-bold text-lg">Requirements List</h2>
      </div>

      <div className="table-wrapper">
        <table className="w-full border-collapse border border-gray-400 text-sm">
          <thead className="bg-gray-100 sticky-header">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  ref={(el) => (thRefs.current[col] = el)}
                  className="border p-1 align-top"
                  style={{
                    width: colWidths[col] ? `${colWidths[col]}px` : "auto",
                  }}
                >
                  <div
                    className="th-content cursor-pointer"
                    onClick={() => handleSort(col)}
                  >
                    <span>
                      {col === "requirementid" && "Req ID"}
                      {col === "title" && "Job Title"}
                      {col === "client" && "Client"}
                      {col === "slots" && "Slots"}
                      {col === "status" && "Status"}
                      {col === "assigned_recruiters" &&
                        "Assigned Recruiter(s)"}
                      {col === "working" && "Working?"}
                    </span>
                    {sortConfig.field === col && (
                      <span>
                        {sortConfig.direction === "ascending" ? "▲" : "▼"}
                      </span>
                    )}
                  </div>
                  {col !== "working" && (
                    <input
                      placeholder="Filter..."
                      className="filter-input mt-1 w-full border rounded px-1 py-0.5 text-xs"
                      value={filters[col] ?? ""}
                      onChange={(e) => handleFilter(col, e.target.value)}
                    />
                  )}
                  <div
                    className="resize-handle"
                    onMouseDown={(e) => startResize(e, col)}
                  />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedRows.map((row) => {
              const recruiters = row.assigned_recruiters || [];
              const someoneWorking = recruiters.length > 0;

              return (
                <tr key={row.requirementid}>
                  {columns.map((col) => {
                    if (col === "working") {
                      const assignedUsers = recruiters;
                      return (
                        <td key={col} className="border p-1 text-center">
                          <input
                            type="checkbox"
                            checked={assignedUsers.includes(currentUser)}
                            onChange={() => toggleWorking(row)}
                            disabled={disableCheckbox(row)}
                          />
                        </td>
                      );
                    }

                    if (col === "assigned_recruiters") {
                      const workingTimes = row.working_times || {};
                      const nonWorkable = isNonWorkable(row);
                      return (
                        <td key={col} className="border p-1 text-center">
                          {nonWorkable
                            ? "Non-Workable"
                            : recruiters.length
                            ? recruiters.map((user) => (
                                <div
                                  key={user}
                                  className="flex flex-col items-center text-xs"
                                >
                                  <span
                                    className={
                                      user === currentUser
                                        ? "font-semibold text-green-700"
                                        : ""
                                    }
                                  >
                                    {user}{" "}
                                    {workingTimes[user] && (
                                      <span className="text-gray-500 text-[10px]">
                                        ({formatTime(workingTimes[user])})
                                      </span>
                                    )}
                                  </span>
                                </div>
                              ))
                            : "-"}
                        </td>
                      );
                    }

                    if (col === "status") {
                      const val =
                        editing[row.requirementid]?.[col] ?? row[col] ?? "";
                      const editingUser = editingStatus[row.requirementid];
                      const isEditingOther =
                        editingUser &&
                        editingUser.user !== currentUser &&
                        editingUser.field === col;
                      return (
                        <td
                          key={col}
                          className={`border p-1 text-center status-${val
                            .toLowerCase()
                            .replace(/\s/g, "")}`}
                        >
                          {isEditingOther ? (
                            <div className="text-xs text-orange-500 italic">
                              {editingUser.user} editing...
                            </div>
                          ) : (
                            <select
                              className="table-input"
                              value={val}
                              onChange={(e) =>
                                handleEdit(
                                  row.requirementid,
                                  col,
                                  e.target.value
                                )
                              }
                              onBlur={() => handleSave(row.requirementid)}
                              disabled={someoneWorking}
                            >
                              {[
                                "Open",
                                "Closed",
                                "On Hold",
                                "Filled",
                                "Cancelled",
                              ].map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      );
                    }

                    const val =
                      editing[row.requirementid]?.[col] ?? row[col] ?? "";
                    const editingUser = editingStatus[row.requirementid];
                    const isEditingOther =
                      editingUser &&
                      editingUser.user !== currentUser &&
                      editingUser.field === col;

                    return (
                      <td key={col} className="border p-1 text-center">
                        {isEditingOther ? (
                          <div className="text-xs text-orange-500 italic">
                            {editingUser.user} editing...
                          </div>
                        ) : (
                          <input
                            className="table-input"
                            value={val}
                            onChange={(e) =>
                              handleEdit(
                                row.requirementid,
                                col,
                                e.target.value
                              )
                            }
                            onBlur={() => handleSave(row.requirementid)}
                            disabled={col === "slots" && someoneWorking}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex justify-between items-center mt-3 text-sm">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            ← Prev
          </button>
          <span>
            Page {currentPage} of {totalPages || 1}
          </span>
          <button
            onClick={() =>
              setCurrentPage((p) => Math.min(p + 1, totalPages))
            }
            disabled={currentPage === totalPages || totalPages === 0}
            className="px-3 py-1 border rounded disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
});

export default Table;
