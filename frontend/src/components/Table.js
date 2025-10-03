import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "./Table.css";

const API_BASE = "/api/requisitions";

function Table({ currentUser, socket }) {
  const [rows, setRows] = useState([]);
  const [draftRows, setDraftRows] = useState({}); // Holds temporary input values
  const [filters, setFilters] = useState({
    requirementId: "",
    client: "",
    title: "",
    status: "",
    slots: "",
  });

  // Fetch initial rows
  useEffect(() => {
    fetch(API_BASE)
      .then(r => r.json())
      .then(setRows)
      .catch(console.error);
  }, []);

  // Setup socket.io listeners
  useEffect(() => {
    if (!socket) return;

    socket.on("rowUpdated", row => {
      setRows(prev =>
        prev.map(r => (r.requirementId === row.requirementId ? row : r))
      );
    });

    socket.on("rowAdded", row => {
      setRows(prev => [row, ...prev]);
    });

    return () => {
      socket.off("rowUpdated");
      socket.off("rowAdded");
    };
  }, [socket]);

  // Filtered rows
  const filteredRows = rows.filter(row =>
    Object.entries(filters).every(([key, value]) =>
      value ? String(row[key]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  // Update draft value locally
  const handleDraftChange = (requirementId, field, value) => {
    setDraftRows(prev => ({
      ...prev,
      [requirementId]: { ...prev[requirementId], [field]: value },
    }));
  };

  // Commit draft to backend on blur
  const commitRowUpdate = async (row) => {
    const draft = draftRows[row.requirementId] || {};
    if (Object.keys(draft).length === 0) return; // nothing to update

    const updatedRow = { ...row, ...draft };

    try {
      const res = await fetch(`${API_BASE}/${row.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRow),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "DB Update Failed");
        return;
      }
      const saved = await res.json();
      setRows(prev =>
        prev.map(r => (r.requirementId === saved.requirementId ? saved : r))
      );
      setDraftRows(prev => ({ ...prev, [row.requirementId]: {} }));
    } catch (err) {
      console.error(err);
      toast.error("DB Update Failed");
    }
  };

  // Add a blank row
  const addRow = async () => {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirementId: `REQ-${Date.now()}`,
          client: "",
          title: "",
          status: "Open",
          slots: 0,
        }),
      });
      const newRow = await res.json();
      setRows(prev => [newRow, ...prev]);
    } catch (err) {
      console.error(err);
      toast.error("DB insert failed");
    }
  };

  // Handle working checkbox
  const handleWorkingChange = async (row) => {
    if (!row.working) {
      // Check if user already has another working row
      const alreadyWorking = rows.some(
        r => r.working && r.assignedRecruiter === currentUser
      );
      if (alreadyWorking) {
        toast.error(
          "You're already working on another requirement. Please free it to start working on this req."
        );
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/${row.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ working: !row.working, userName: currentUser }),
      });
      const updatedRow = await res.json();
      setRows(prev =>
        prev.map(r => (r.requirementId === updatedRow.requirementId ? updatedRow : r))
      );
    } catch (err) {
      console.error(err);
      toast.error("DB Error");
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="table-container">
      <button className="add-btn" onClick={addRow}>➕ Add Row</button>

      <table>
        <thead>
          <tr>
            {["requirementId","client","title","status","slots"].map(col => (
              <th key={col}>
                {col.charAt(0).toUpperCase() + col.slice(1)}<br/>
                <input
                  placeholder="Filter..."
                  value={filters[col]}
                  onChange={e => handleFilterChange(col, e.target.value)}
                />
              </th>
            ))}
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map(row => {
            const draft = draftRows[row.requirementId] || {};
            const isWorkable = row.status === "Open" && row.slots > 0;
            const lockedByOther =
              row.working && row.assignedRecruiter && row.assignedRecruiter !== currentUser;

            return (
              <tr key={row.requirementId}>
                {["requirementId","client","title","status","slots"].map(field => (
                  <td key={field}>
                    {field === "status" ? (
                      <select
                        value={draft[field] ?? row[field]}
                        disabled={lockedByOther}
                        onChange={e => handleDraftChange(row.requirementId, field, e.target.value)}
                        onBlur={() => commitRowUpdate(row)}
                      >
                        <option value="Open">Open</option>
                        <option value="Closed">Closed</option>
                        <option value="On Hold">On Hold</option>
                      </select>
                    ) : (
                      <input
                        value={draft[field] ?? row[field]}
                        disabled={lockedByOther}
                        onChange={e => handleDraftChange(row.requirementId, field, e.target.value)}
                        onBlur={() => commitRowUpdate(row)}
                      />
                    )}
                  </td>
                ))}
                <td>
                  {isWorkable
                    ? row.assignedRecruiter || ""
                    : <span className="non-workable">Non-Workable</span>}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.working}
                    disabled={!isWorkable || lockedByOther}
                    onChange={() => handleWorkingChange(row)}
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
