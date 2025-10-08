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
  const [localEdits, setLocalEdits] = useState({});
  const [remoteEditing, setRemoteEditing] = useState({});
  const editingRef = useRef(new Set());
  const [filters, setFilters] = useState({ requirementId: "", client: "", title: "", status: "" });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const PAGE_SIZE = 20;
  const [currentPage, setCurrentPage] = useState(1);

  const [columns, setColumns] = useState([
    { id: "requirementId", label: "Requirement ID", width: 160 },
    { id: "client", label: "Client Name", width: 220 },
    { id: "title", label: "Job Title", width: 260 },
    { id: "status", label: "Status", width: 140 },
    { id: "slots", label: "Slots", width: 100 },
    { id: "assigned", label: "Assigned Recruiters", width: 220 },
    { id: "working", label: "Working", width: 110 },
  ]);

  const resizing = useRef({ active: false, colId: null, startX: 0, startWidth: 0 });
  const dragCol = useRef(null);

  useEffect(() => {
    fetchRows();

    socket.on("requisitions_updated", (data) => {
      setRows((prevRows) => {
        const mapPrev = {};
        prevRows.forEach((r) => (mapPrev[r.requirementId] = r));
        return data.map((incoming) => {
          const existing = mapPrev[incoming.requirementId];
          if (!existing) return incoming;
          const mergedRow = { ...incoming };
          ["client", "title", "status", "slots", "requirementId"].forEach((f) => {
            const key = `${incoming.requirementId}::${f}`;
            if (localEdits[key] !== undefined && editingRef.current.has(key)) {
              mergedRow[f] = localEdits[key];
            }
          });
          mergedRow.assigned_recruiters = incoming.assigned_recruiters || [];
          mergedRow.working_times = incoming.working_times || {};
          return mergedRow;
        });
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
  }, [localEdits]);

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

  const handleLocalChange = (requirementId, field, value) => {
    const key = `${requirementId}::${field}`;
    setLocalEdits((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (originalReqId, field) => {
    const key = `${originalReqId}::${field}`;
    if (!(key in localEdits)) {
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      return;
    }
    const value = localEdits[key];
    try {
      if (field === "requirementId") {
        if (value && value !== originalReqId) {
          await axios.put(`/api/requisitions/${originalReqId}`, { newRequirementId: value });
        }
      } else if (field === "slots") {
        await axios.put(`/api/requisitions/${originalReqId}`, { slots: Number(value || 0) });
      } else {
        await axios.put(`/api/requisitions/${originalReqId}`, { [field]: value });
      }
      setLocalEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
    } catch (err) {
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

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);

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

  const displayValue = (row, field) => {
    const key = `${row.requirementId}::${field}`;
    if (localEdits[key] !== undefined) return localEdits[key];
    if (field === "requirementId") return row.requirementId ?? "";
    if (field === "slots") return row.slots ?? 0;
    return row[field] ?? "";
  };

  const handleFocus = (requirementId, field) => {
    const key = `${requirementId}::${field}`;
    editingRef.current.add(key);
    broadcastEditing(requirementId, field, true);
    setLocalEdits((prev) => {
      if (prev[key] !== undefined) return prev;
      const row = rows.find((r) => r.requirementId === requirementId);
      const initial = row ? (field === "slots" ? row.slots ?? 0 : row[field] ?? "") : "";
      return { ...prev, [key]: initial };
    });
  };

  const handleKeyDown = (e, originalReqId, field) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave(originalReqId, field);
      if (e.target) e.target.blur();
    }
    if (e.key === "Escape") {
      const key = `${originalReqId}::${field}`;
      setLocalEdits((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
      editingRef.current.delete(key);
      broadcastEditing(originalReqId, field, false);
      fetchRows();
      if (e.target) e.target.blur();
    }
  };

  return (
    <div className="table-container">
      {/* Controls above table */}
      <div className="table-actions">
        <button onClick={addRow}>Add Row</button>

        <div className="pagination-controls">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} title="First">«</button>
          <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>‹</button>
          <span className="page-indicator">
            Page {currentPage} / {totalPages}
          </span>
          <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>›</button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} title="Last">»</button>
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

            {/* Filter row */}
            <tr className="filter-row">
              {columns.map((col) => {
                if (["requirementId", "client", "title", "status"].includes(col.id)) {
                  return (
                    <th key={`${col.id}-filter`}>
                      <input
                        placeholder="Filter..."
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
                  className={`animated-row ${locked ? "locked" : assignedUsers.includes(currentUser) ? "working-current" : ""}`}
                >
                  {columns.map((col) => {
                    if (col.id === "assigned") {
                      return (
                        <td key={`${row.requirementId}-assigned`}>
                          {assignedUsers.map((user) => (
                            <div key={user} className="assigned-pill" style={{ background: generateColor(user) }}>
                              <span className="assigned-name">{user}</span>
                              <span className="assigned-time">
                                {workingTimes[user] ? ` (${new Date(workingTimes[user]).toLocaleTimeString()})` : ""}
                              </span>
                            </div>
                          ))}
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
                    const key = `${row.requirementId}::${field}`;
                    const remoteEditor = remoteEditing[key];
                    const isEditingLocally = editingRef.current.has(key);

                    return (
                      <td key={`${row.requirementId}-${field}`}>
                        <div className="input-wrapper">
                          {remoteEditor && !isEditingLocally ? (
                            <div className="editing-indicator">{remoteEditor} editing</div>
                          ) : null}
                          {field === "status" ? (
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
                          ) : (
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
                          )}
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
