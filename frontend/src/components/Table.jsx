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
  const [colWidths, setColWidths] = useState({});
  const thRefs = useRef({});
  const [newReq, setNewReq] = useState({
    requirementid: "",
    title: "",
    client: "",
    slots: "",
    status: "Open",
  });

  // === Initialize current user ===
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
      setEditingStatus((prev) => ({
        ...prev,
        [data.requirementid]: data.user
          ? { user: data.user, field: data.field }
          : null,
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

  // === Handle edit and save ===
  const handleEdit = (reqId, field, value) => {
    socket.emit("editing_status", {
      requirementid: reqId,
      user: currentUser,
      field,
    });
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
      socket.emit("editing_status", {
        requirementid: reqId,
        user: null,
        field: null,
      });
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    } catch (err) {
      alert(err.response?.data?.message || "Error saving changes");
      await fetchRows();
      setEditing((prev) => {
        const copy = { ...prev };
        delete copy[reqId];
        return copy;
      });
    }
  };

  // === Add new requisition ===
  const handleAddRequisition = async () => {
    if (!newReq.requirementid.trim()) {
      alert("Please enter a Requirement ID");
      return;
    }
    try {
      await axios.post("/api/requisitions", newReq);
      setNewReq({
        requirementid: "",
        title: "",
        client: "",
        slots: "",
        status: "Open",
      });
      socket.emit("requisitions_updated");
      fetchRows();
    } catch (err) {
      alert(err.response?.data?.message || "Error adding requisition");
    }
  };

  // === Working toggle ===
  const toggleWorking = async (row) => {
    if (!row.requirementid) return;
    const assignedUsers = row.assigned_recruiters || [];
    const isAssigned = assignedUsers.includes(currentUser);
    const alreadyWorking = rows.find(
      (r) =>
        (r.assigned_recruiters || []).includes(currentUser) &&
        r.requirementid !== row.requirementid
    );
    if (!isAssigned && alreadyWorking) {
      alert("You are already working on another requirement.");
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

  // === Sort + Filter ===
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

  // === Column resize ===
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

  // === Format Time ===
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

  // === Render ===
  return (
    <div className="p-4">
      <div className="flex justify-center mb-4">
        <h2 className="font-bold text-lg">Requirements List</h2>
      </div>

      {/* === Add new requisition form === */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          placeholder="Requirement ID"
          value={newReq.requirementid}
          onChange={(e) =>
            setNewReq({ ...newReq, requirementid: e.target.value })
          }
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="Title"
          value={newReq.title}
          onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="text"
          placeholder="Client"
          value={newReq.client}
          onChange={(e) => setNewReq({ ...newReq, client: e.target.value })}
          className="border rounded px-2 py-1 text-sm"
        />
        <input
          type="number"
          placeholder="Slots"
          value={newReq.slots}
          onChange={(e) => setNewReq({ ...newReq, slots: e.target.value })}
          className="border rounded px-2 py-1 text-sm w-20"
        />
        <select
          value={newReq.status}
          onChange={(e) => setNewReq({ ...newReq, status: e.target.value })}
          className={`border rounded px-2 py-1 text-sm status-${newReq.status
            .toLowerCase()
            .replace(/\s/g, "")}`}
        >
          {["Open", "Closed", "On Hold", "Filled", "Cancelled"].map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        <button
          onClick={handleAddRequisition}
          className="bg-blue-500 text-white px-3 py-1 rounded"
        >
          Add
        </button>
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
                  style={{ width: colWidths[col] }}
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
            {paginatedRows.map((row) => (
              <tr key={row.requirementid}>
                {columns.map((col) => {
                  if (col === "working") {
                    const assignedUsers = row.assigned_recruiters || [];
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
                    const assignedUsers = row.assigned_recruiters || [];
                    const workingTimes = row.working_times || {};
                    const nonWorkable = isNonWorkable(row);
                    return (
                      <td key={col} className="border p-1 text-center">
                        {nonWorkable
                          ? "Non-Workable"
                          : assignedUsers.length
                          ? assignedUsers.map((user) => (
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
                                  {user}
                                </span>
                                {workingTimes[user] && (
                                  <span className="text-[10px] text-gray-500">
                                    {formatTime(workingTimes[user])}
                                  </span>
                                )}
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
                            className="border rounded px-1 text-sm"
                            value={val}
                            onChange={(e) =>
                              handleEdit(row.requirementid, col, e.target.value)
                            }
                            onBlur={() => handleSave(row.requirementid)}
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
                          className="border rounded px-1 text-sm w-full"
                          value={val}
                          onChange={(e) =>
                            handleEdit(row.requirementid, col, e.target.value)
                          }
                          onBlur={() => handleSave(row.requirementid)}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default Table;
