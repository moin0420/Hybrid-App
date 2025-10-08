/*

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
  const [reqIdEdits, setReqIdEdits] = useState({});
  const [filters, setFilters] = useState({ requirementId: "", client: "", title: "", status: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Pagination
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // Column configuration: id = field key, label = header text, width in px
  const [columns, setColumns] = useState([
    { id: "requirementId", label: "Requirement ID", width: 160 },
    { id: "client", label: "Client Name", width: 220 },
    { id: "title", label: "Job Title", width: 260 },
    { id: "status", label: "Status", width: 140 },
    { id: "slots", label: "Slots", width: 100 },
    { id: "assigned", label: "Assigned Recruiters", width: 220 },
    { id: "working", label: "Working", width: 110 },
  ]);

  // Resize refs
  const resizing = useRef({ active: false, colId: null, startX: 0, startWidth: 0 });

  // Drag & drop (reorder)
  const dragCol = useRef(null);

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

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing.current.active) return;
      const delta = e.clientX - resizing.current.startX;
      const newWidth = Math.max(60, resizing.current.startWidth + delta);
      setColumns((prev) =>
        prev.map((c) => (c.id === resizing.current.colId ? { ...c, width: newWidth } : c))
      );
    };
    const handleMouseUp = () => {
      resizing.current.active = false;
      resizing.current.colId = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
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
    if (field === "requirementId") return;
    setRows((prev) =>
      prev.map((r) => (r.requirementId === requirementId ? { ...r, [field]: value } : r))
    );
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
    const assignedUsers = row.assigned_recruiters || [];
    const isAlreadyAssigned = assignedUsers.includes(currentUser);

    const userWorkingElsewhere = rows.some(
      (r) =>
        r.requirementId !== row.requirementId &&
        (r.assigned_recruiters || []).includes(currentUser)
    );

    if (!isAlreadyAssigned && userWorkingElsewhere) {
      alert("You are already working on another requirement.");
      return;
    }
    if (!isAlreadyAssigned && assignedUsers.length >= 2) {
      alert("Maximum 2 users already assigned.");
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
      // move to first page to show the latest inserted (backend returns DESC)
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Add row failed");
    }
  };

  const isLockedByOther = (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const userWorkingElsewhere = rows.some(
      (r) =>
        r.requirementId !== row.requirementId &&
        (r.assigned_recruiters || []).includes(currentUser)
    );
    return (
      (assignedUsers.length >= 2 && !assignedUsers.includes(currentUser)) ||
      (!assignedUsers.includes(currentUser) && userWorkingElsewhere)
    );
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Filtering
  const filteredRows = rows.filter((row) =>
    Object.entries(filters).every(([key, val]) => {
      if (!val) return true;
      const v =
        key === "requirementId"
          ? row.requirementId
          : key === "client"
          ? row.client
          : key === "title"
          ? row.title
          : key === "status"
          ? row.status
          : "";
      return (v ?? "").toString().toLowerCase().includes(val.toLowerCase());
    })
  );

  // Sorting
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal =
      sortConfig.key === "requirementId"
        ? a.requirementId?.toString().toLowerCase()
        : (a[sortConfig.key] ?? "").toString().toLowerCase();
    const bVal =
      sortConfig.key === "requirementId"
        ? b.requirementId?.toString().toLowerCase()
        : (b[sortConfig.key] ?? "").toString().toLowerCase();

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

  // Column resize handlers
  const startResize = (colId, e) => {
    e.preventDefault();
    resizing.current = {
      active: true,
      colId,
      startX: e.clientX,
      startWidth: columns.find((c) => c.id === colId).width,
    };
  };

  // Column reorder handlers
  const onDragStart = (colId, e) => {
    dragCol.current = colId;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (targetColId) => {
    const source = dragCol.current;
    if (!source || source === targetColId) return;
    const srcIndex = columns.findIndex((c) => c.id === source);
    const tgtIndex = columns.findIndex((c) => c.id === targetColId);
    const newCols = [...columns];
    const [moved] = newCols.splice(srcIndex, 1);
    newCols.splice(tgtIndex, 0, moved);
    setColumns(newCols);
    dragCol.current = null;
  };

  return (
    <div className="table-container">
      <div className="table-actions">
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={addRow}>Add Row</button>
          <div className="global-search">
            <input
              placeholder="Global search..."
              onChange={(e) => {
                const v = e.target.value;
                // apply to all text filters quickly
                setFilters({ requirementId: v, client: v, title: v, status: v });
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="pagination-controls">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First"
          >
            «
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          <span className="page-indicator">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last"
          >
            »
          </button>
        </div>
      </div>

      <div className="responsive-table-wrapper">
        <table className="req-table" role="grid">
          <colgroup>
            {columns.map((col) => (
              <col key={col.id} style={{ width: `${col.width}px`, minWidth: `${col.width}px` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  draggable
                  onDragStart={(e) => onDragStart(col.id, e)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(col.id)}
                  style={{ width: col.width }}
                  className={sortConfig.key === col.id ? (sortConfig.direction === "asc" ? "sorted-asc" : "sorted-desc") : ""}
                >
                  <div
                    className="th-content"
                    onClick={() => {
                      // only sort for data columns (not assigned)
                      if (["requirementId", "client", "title", "status", "slots"].includes(col.id)) {
                        handleSort(col.id);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    {col.label}
                    {sortConfig.key === col.id ? (
                      <span className="sort-arrow">{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                    ) : null}
                  </div>

                  
                  <div
                    className="col-resizer"
                    onMouseDown={(e) => startResize(col.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    role="separator"
                    aria-orientation="horizontal"
                  />
                </th>
              ))}
            </tr>

            <tr className="filter-row">
              {columns.map((col) => {
                if (["requirementId", "client", "title", "status"].includes(col.id)) {
                  return (
                    <th key={`${col.id}-filter`}>
                      <input
                        placeholder={`Filter ${col.label}`}
                        value={filters[col.id] ?? ""}
                        onChange={(e) => {
                          setFilters((prev) => ({ ...prev, [col.id]: e.target.value }));
                          setCurrentPage(1);
                        }}
                      />
                    </th>
                  );
                }
                return <th key={`${col.id}-filter`}></th>;
              })}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row) => {
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
                  {columns.map((col) => {
                    // custom rendering for assigned/working columns
                    if (col.id === "assigned") {
                      return (
                        <td key={`${row.requirementId}-assigned`}>
                          {assignedUsers.length > 0
                            ? assignedUsers.map((user) => (
                                <div key={user} className="assigned-pill" style={{ background: generateColor(user) }}>
                                  <span className="assigned-name">{user}</span>
                                  <span className="assigned-time">
                                    {workingTimes[user] ? ` (${new Date(workingTimes[user]).toLocaleTimeString()})` : ""}
                                  </span>
                                </div>
                              ))
                            : row.status !== "Open" || row.slots <= 0
                            ? "Non-Workable"
                            : ""}
                        </td>
                      );
                    }

                    if (col.id === "working") {
                      return (
                        <td key={`${row.requirementId}-working`}>
                          <input
                            type="checkbox"
                            checked={assignedUsers.includes(currentUser)}
                            disabled={locked}
                            onChange={() => toggleWorking(row)}
                          />
                        </td>
                      );
                    }

                    // editable fields: requirementId, client, title, status, slots
                    const field = col.id;
                    let value = "";
                    if (field === "slots") value = row.slots ?? 0;
                    else if (field === "requirementId") value = row.requirementId ?? "";
                    else value = row[field] ?? "";

                    if (field === "requirementId") {
                      return (
                        <td key={`${row.requirementId}-reqid`}>
                          <div className="input-wrapper">
                            <input
                              type="text"
                              value={reqIdEdits[row.requirementId] ?? value}
                              disabled={locked}
                              onChange={(e) =>
                                setReqIdEdits((prev) => ({ ...prev, [row.requirementId]: e.target.value }))
                              }
                              onBlur={async () => {
                                const newValue = reqIdEdits[row.requirementId];
                                if (newValue && newValue !== row.requirementId) {
                                  try {
                                    await axios.put(`/api/requisitions/${row.requirementId}`, {
                                      newRequirementId: newValue,
                                    });
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
                              style={{ width: "100%" }}
                            />
                          </div>
                        </td>
                      );
                    }

                    if (field === "status") {
                      return (
                        <td key={`${row.requirementId}-status`}>
                          <select
                            value={value || "Open"}
                            disabled={locked}
                            onChange={(e) => handleFieldChange(row.requirementId, "status", e.target.value)}
                          >
                            <option value="Open">Open</option>
                            <option value="On Hold">On Hold</option>
                            <option value="Closed">Closed</option>
                            <option value="Cancelled">Cancelled</option>
                            <option value="Filled">Filled</option>
                          </select>
                        </td>
                      );
                    }

                    // generic input for client/title/slots
                    return (
                      <td key={`${row.requirementId}-${field}`}>
                        <input
                          type={field === "slots" ? "number" : "text"}
                          value={value}
                          disabled={locked}
                          onChange={(e) =>
                            handleFieldChange(
                              row.requirementId,
                              field,
                              field === "slots" ? Number(e.target.value) : e.target.value
                            )
                          }
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;

*/


// frontend/components/table.js
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
  // localEdits holds values the user is actively typing: { "REQ-123::client": "Acme" }
  const [localEdits, setLocalEdits] = useState({});
  // remoteEditing shows who else is editing a specific field: { "REQ-123::client": "Alice" }
  const [remoteEditing, setRemoteEditing] = useState({});
  // tracks which fields this client is currently editing (for ignoring incoming updates)
  const editingRef = useRef(new Set());

  const [reqIdEdits, setReqIdEdits] = useState({});
  const [filters, setFilters] = useState({ requirementId: "", client: "", title: "", status: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Pagination + columns left intact from your previous version (page size 20)
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  // columns config (kept same as earlier)
  const [columns, setColumns] = useState([
    { id: "requirementId", label: "Requirement ID", width: 160 },
    { id: "client", label: "Client Name", width: 220 },
    { id: "title", label: "Job Title", width: 260 },
    { id: "status", label: "Status", width: 140 },
    { id: "slots", label: "Slots", width: 100 },
    { id: "assigned", label: "Assigned Recruiters", width: 220 },
    { id: "working", label: "Working", width: 110 },
  ]);

  // resizing + drag refs (kept as in previous)
  const resizing = useRef({ active: false, colId: null, startX: 0, startWidth: 0 });
  const dragCol = useRef(null);

  useEffect(() => {
    fetchRows();

    socket.on("requisitions_updated", (data) => {
      // Merge data but do not overwrite any cell currently being edited locally
      setRows((prevRows) => {
        const mapPrev = {};
        prevRows.forEach((r) => (mapPrev[r.requirementId] = r));
        const merged = data.map((incoming) => {
          const existing = mapPrev[incoming.requirementId];
          if (!existing) return incoming;
          // for each field, if user is editing it, keep local value instead of incoming
          const mergedRow = { ...incoming }; // base from incoming to pick up latest ids etc
          ["client", "title", "status", "slots", "requirementId"].forEach((f) => {
            const key = `${incoming.requirementId}::${f}`;
            if (localEdits[key] !== undefined && editingRef.current.has(key)) {
              // keep local editing value
              mergedRow[f === "requirementId" ? "requirementId" : f] = localEdits[key];
            } else {
              // else keep incoming (latest)
              // already set from incoming
            }
          });
          // preserve assigned_recruiters and working_times from incoming (they're arrays/objects)
          mergedRow.assigned_recruiters = incoming.assigned_recruiters || [];
          mergedRow.working_times = incoming.working_times || {};
          return mergedRow;
        });
        return merged;
      });
    });

    socket.on("editing_status", ({ requirementId, field, userName, isEditing }) => {
      const key = `${requirementId}::${field}`;
      setRemoteEditing((prev) => {
        const copy = { ...prev };
        if (isEditing) copy[key] = userName;
        else delete copy[key];
        return copy;
      });
    });

    return () => {
      socket.off("requisitions_updated");
      socket.off("editing_status");
    };
    
  }, [localEdits]); // include localEdits so merge logic can reference latest edits

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Emit editing status to server (server rebroadcasts to others)
  const broadcastEditing = (requirementId, field, isEditing) => {
    socket.emit("editing_status", { requirementId, field, userName: currentUser, isEditing });
  };

  // When user types, only update localEdits (do not send to server yet)
  const handleLocalChange = (requirementId, field, value) => {
    const key = `${requirementId}::${field}`;
    setLocalEdits((prev) => ({ ...prev, [key]: value }));
  };

  // Save on blur (or Enter)
  const handleSave = async (originalReqId, field) => {
    const key = `${originalReqId}::${field}`;
    if (!(key in localEdits)) {
      // nothing to save
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      return;
    }
    const value = localEdits[key];

    try {
      // Special handling for requirementId (rename)
      if (field === "requirementId") {
        // If user changed the ID, send newRequirementId to backend (existing logic)
        if (value && value !== originalReqId) {
          await axios.put(`/api/requisitions/${originalReqId}`, { newRequirementId: value });
        }
      } else if (field === "slots") {
        // ensure numeric
        const numeric = Number(value || 0);
        await axios.put(`/api/requisitions/${originalReqId}`, { slots: numeric });
      } else {
        const body = {};
        body[field] = value;
        await axios.put(`/api/requisitions/${originalReqId}`, body);
      }
      // After successful save: remove local edit and stop editing flag
      setLocalEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      // let server broadcast the authoritative updated rows (requisitions_updated) which will merge
    } catch (err) {
      // on error, notify user and re-fetch to restore consistent state
      console.error("Save failed:", err);
      alert(err.response?.data?.message || "Save failed");
      setLocalEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      fetchRows();
    }
  };

  // Toggle working status sends immediately (preserves your business rules on backend)
  const toggleWorking = async (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const isAlreadyAssigned = assignedUsers.includes(currentUser);

    const userWorkingElsewhere = rows.some(
      (r) =>
        r.requirementId !== row.requirementId &&
        (r.assigned_recruiters || []).includes(currentUser)
    );

    if (!isAlreadyAssigned && userWorkingElsewhere) {
      alert("You are already working on another requirement.");
      return;
    }
    if (!isAlreadyAssigned && assignedUsers.length >= 2) {
      alert("Maximum 2 users already assigned.");
      return;
    }

    try {
      await axios.put(`/api/requisitions/${row.requirementId}`, {
        working: !isAlreadyAssigned,
        userName: currentUser,
      });
      // server's broadcast will update UI
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
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Add row failed");
    }
  };

  const isLockedByOther = (row) => {
    const assignedUsers = row.assigned_recruiters || [];
    const userWorkingElsewhere = rows.some(
      (r) =>
        r.requirementId !== row.requirementId &&
        (r.assigned_recruiters || []).includes(currentUser)
    );
    return (
      (assignedUsers.length >= 2 && !assignedUsers.includes(currentUser)) ||
      (!assignedUsers.includes(currentUser) && userWorkingElsewhere)
    );
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // Filtering
  const filteredRows = rows.filter((row) =>
    Object.entries(filters).every(([key, val]) => {
      if (!val) return true;
      const v =
        key === "requirementId"
          ? row.requirementId
          : key === "client"
          ? row.client
          : key === "title"
          ? row.title
          : key === "status"
          ? row.status
          : "";
      return (v ?? "").toString().toLowerCase().includes(val.toLowerCase());
    })
  );

  // Sorting
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal =
      sortConfig.key === "requirementId"
        ? a.requirementId?.toString().toLowerCase()
        : (a[sortConfig.key] ?? "").toString().toLowerCase();
    const bVal =
      sortConfig.key === "requirementId"
        ? b.requirementId?.toString().toLowerCase()
        : (b[sortConfig.key] ?? "").toString().toLowerCase();

    if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

  // Column resize handlers (kept)
  const startResize = (colId, e) => {
    e.preventDefault();
    resizing.current = {
      active: true,
      colId,
      startX: e.clientX,
      startWidth: columns.find((c) => c.id === colId).width,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing.current.active) return;
      const delta = e.clientX - resizing.current.startX;
      const newWidth = Math.max(60, resizing.current.startWidth + delta);
      setColumns((prev) =>
        prev.map((c) => (c.id === resizing.current.colId ? { ...c, width: newWidth } : c))
      );
    };
    const handleMouseUp = () => {
      resizing.current.active = false;
      resizing.current.colId = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [columns]);

  // Column reorder handlers (kept)
  const onDragStart = (colId, e) => {
    dragCol.current = colId;
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (targetColId) => {
    const source = dragCol.current;
    if (!source || source === targetColId) return;
    const srcIndex = columns.findIndex((c) => c.id === source);
    const tgtIndex = columns.findIndex((c) => c.id === targetColId);
    const newCols = [...columns];
    const [moved] = newCols.splice(srcIndex, 1);
    newCols.splice(tgtIndex, 0, moved);
    setColumns(newCols);
    dragCol.current = null;
  };

  // Helpers to get current displayed value (prefer localEdits if present)
  const displayValue = (row, field) => {
    const key = `${row.requirementId}::${field}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    // map internal keys
    if (field === "requirementId") return row.requirementId ?? "";
    if (field === "slots") return row.slots ?? 0;
    return row[field] ?? "";
  };

  // When focus enters an input -> broadcast editing true, mark editingRef
  const handleFocus = (requirementId, field) => {
    const key = `${requirementId}::${field}`;
    editingRef.current.add(key);
    broadcastEditing(requirementId, field, true);
    // initialize localEdits with current row value if not set
    setLocalEdits((prev) => {
      if (prev[key] !== undefined) return prev;
      const row = rows.find((r) => r.requirementId === requirementId);
      const initial = row ? (field === "slots" ? row.slots ?? 0 : row[field] ?? "") : "";
      return { ...prev, [key]: initial };
    });
  };

  // When pressing Enter in an input, commit save immediately
  const handleKeyDown = (e, originalReqId, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave(originalReqId, field);
      // blur the input to end editing mode
      if (e.target) e.target.blur();
    }
    if (e.key === "Escape") {
      // Cancel edit: remove local edit and stop editing mode
      const key = `${originalReqId}::${field}`;
      setLocalEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      // also refetch to restore authoritative value
      fetchRows();
      if (e.target) e.target.blur();
    }
  };

  return (
    <div className="table-container">
      <div className="table-actions">
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={addRow}>Add Row</button>
          <div className="global-search">
            <input
              placeholder="Global search..."
              onChange={(e) => {
                const v = e.target.value;
                setFilters({ requirementId: v, client: v, title: v, status: v });
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        <div className="pagination-controls">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First"
          >
            «
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            ‹
          </button>
          <span className="page-indicator">
            Page {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            ›
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last"
          >
            »
          </button>
        </div>
      </div>

      <div className="responsive-table-wrapper">
        <table className="req-table" role="grid">
          <colgroup>
            {columns.map((col) => (
              <col key={col.id} style={{ width: `${col.width}px`, minWidth: `${col.width}px` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  draggable
                  onDragStart={(e) => onDragStart(col.id, e)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(col.id)}
                  style={{ width: col.width }}
                  className={sortConfig.key === col.id ? (sortConfig.direction === "asc" ? "sorted-asc" : "sorted-desc") : ""}
                >
                  <div
                    className="th-content"
                    onClick={() => {
                      if (["requirementId", "client", "title", "status", "slots"].includes(col.id)) {
                        handleSort(col.id);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    {col.label}
                    {sortConfig.key === col.id ? (
                      <span className="sort-arrow">{sortConfig.direction === "asc" ? " ▲" : " ▼"}</span>
                    ) : null}
                  </div>

                  <div
                    className="col-resizer"
                    onMouseDown={(e) => startResize(col.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    role="separator"
                    aria-orientation="horizontal"
                  />
                </th>
              ))}
            </tr>

            <tr className="filter-row">
              {columns.map((col) => {
                if (["requirementId", "client", "title", "status"].includes(col.id)) {
                  return (
                    <th key={`${col.id}-filter`}>
                      <input
                        placeholder={`Filter ${col.label}`}
                        value={filters[col.id] ?? ""}
                        onChange={(e) => {
                          setFilters((prev) => ({ ...prev, [col.id]: e.target.value }));
                          setCurrentPage(1);
                        }}
                      />
                    </th>
                  );
                }
                return <th key={`${col.id}-filter`}></th>;
              })}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row) => {
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
                  {columns.map((col) => {
                    if (col.id === "assigned") {
                      return (
                        <td key={`${row.requirementId}-assigned`}>
                          {assignedUsers.length > 0
                            ? assignedUsers.map((user) => (
                                <div key={user} className="assigned-pill" style={{ background: generateColor(user) }}>
                                  <span className="assigned-name">{user}</span>
                                  <span className="assigned-time">
                                    {workingTimes[user] ? ` (${new Date(workingTimes[user]).toLocaleTimeString()})` : ""}
                                  </span>
                                </div>
                              ))
                            : row.status !== "Open" || row.slots <= 0
                            ? "Non-Workable"
                            : ""}
                        </td>
                      );
                    }

                    if (col.id === "working") {
                      return (
                        <td key={`${row.requirementId}-working`}>
                          <input
                            type="checkbox"
                            checked={assignedUsers.includes(currentUser)}
                            disabled={locked}
                            onChange={() => toggleWorking(row)}
                          />
                        </td>
                      );
                    }

                    const field = col.id;
                    let value = displayValue(row, field);

                    // requirementId special edit behavior
                    if (field === "requirementId") {
                      const key = `${row.requirementId}::requirementId`;
                      const remoteEditor = remoteEditing[key];
                      const isEditingLocally = editingRef.current.has(key);

                      return (
                        <td key={`${row.requirementId}-reqid`}>
                          <div className="input-wrapper">
                            {remoteEditor && !isEditingLocally ? (
                              <div className="editing-indicator">{remoteEditor} editing</div>
                            ) : null}
                            <input
                              type="text"
                              value={value}
                              disabled={locked}
                              onFocus={() => handleFocus(row.requirementId, "requirementId")}
                              onChange={(e) => handleLocalChange(row.requirementId, "requirementId", e.target.value)}
                              onBlur={() => handleSave(row.requirementId, "requirementId")}
                              onKeyDown={(e) => handleKeyDown(e, row.requirementId, "requirementId")}
                              style={{ width: "100%" }}
                            />
                          </div>
                        </td>
                      );
                    }

                    if (field === "status") {
                      const key = `${row.requirementId}::status`;
                      const remoteEditor = remoteEditing[key];
                      const isEditingLocally = editingRef.current.has(key);

                      return (
                        <td key={`${row.requirementId}-status`}>
                          <div className="input-wrapper">
                            {remoteEditor && !isEditingLocally ? (
                              <div className="editing-indicator">{remoteEditor} editing</div>
                            ) : null}
                            <select
                              value={value || "Open"}
                              disabled={locked}
                              onFocus={() => handleFocus(row.requirementId, "status")}
                              onChange={(e) => handleLocalChange(row.requirementId, "status", e.target.value)}
                              onBlur={() => handleSave(row.requirementId, "status")}
                            >
                              <option value="Open">Open</option>
                              <option value="On Hold">On Hold</option>
                              <option value="Closed">Closed</option>
                              <option value="Cancelled">Cancelled</option>
                              <option value="Filled">Filled</option>
                            </select>
                          </div>
                        </td>
                      );
                    }

                    // generic input for client/title/slots
                    const key = `${row.requirementId}::${field}`;
                    const remoteEditor = remoteEditing[key];
                    const isEditingLocally = editingRef.current.has(key);

                    return (
                      <td key={`${row.requirementId}-${field}`}>
                        <div className="input-wrapper">
                          {remoteEditor && !isEditingLocally ? (
                            <div className="editing-indicator">{remoteEditor} editing</div>
                          ) : null}
                          <input
                            type={field === "slots" ? "number" : "text"}
                            value={value}
                            disabled={locked}
                            onFocus={() => handleFocus(row.requirementId, field)}
                            onChange={(e) =>
                              handleLocalChange(row.requirementId, field, field === "slots" ? Number(e.target.value) : e.target.value)
                            }
                            onBlur={() => handleSave(row.requirementId, field)}
                            onKeyDown={(e) => handleKeyDown(e, row.requirementId, field)}
                          />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
