import React, { useState, useEffect } from "react";
import "./Table.css";

const API_BASE = "/api/requisitions";

function Table({ currentUser, socket }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({
    requirementId: "",
    client: "",
    title: "",
    status: "",
    slots: "",
    assignedRecruiter: "",
  });

  // Fetch initial rows
  useEffect(() => {
    fetch(API_BASE).then(r => r.json()).then(setRows).catch(console.error);
  }, []);

  // Socket updates
  useEffect(() => {
    if (!socket) return;
    socket.on("rowUpdated", row =>
      setRows(prev => prev.map(r => r.requirementId === row.requirementId ? row : r))
    );
    socket.on("rowAdded", row => setRows(prev => [row, ...prev]));
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

  const updateRow = (requirementId, field, value) => {
    // Update local state immediately
    setRows(prev =>
      prev.map(r => r.requirementId === requirementId ? { ...r, [field]: value } : r)
    );

    // Send update to backend
    fetch(`${API_BASE}/${requirementId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value, userName: currentUser }),
    }).catch(console.error);
  };

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
            <th>
              Requirement ID <br />
              <input
                placeholder="Filter..."
                value={filters.requirementId}
                onChange={e => handleFilterChange("requirementId", e.target.value)}
              />
            </th>
            <th>
              Client <br />
              <input
                placeholder="Filter..."
                value={filters.client}
                onChange={e => handleFilterChange("client", e.target.value)}
              />
            </th>
            <th>
              Title <br />
              <input
                placeholder="Filter..."
                value={filters.title}
                onChange={e => handleFilterChange("title", e.target.value)}
              />
            </th>
            <th>
              Status <br />
              <select
                value={filters.status}
                onChange={e => handleFilterChange("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="On Hold">On Hold</option>
              </select>
            </th>
            <th>
              Slots <br />
              <input
                type="number"
                placeholder="Filter..."
                value={filters.slots}
                onChange={e => handleFilterChange("slots", e.target.value)}
              />
            </th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredRows.map(row => {
            const isWorkable = row.status === "Open" && row.slots > 0;
            const lockedByOther = row.working && row.assignedRecruiter && row.assignedRecruiter !== currentUser;
            return (
              <tr key={row.requirementId}>
                <td>
                  <input
                    value={row.requirementId}
                    disabled={lockedByOther}
                    onChange={e => updateRow(row.requirementId, "requirementId", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.client}
                    disabled={lockedByOther}
                    onChange={e => updateRow(row.requirementId, "client", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.title}
                    disabled={lockedByOther}
                    onChange={e => updateRow(row.requirementId, "title", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={row.status}
                    disabled={lockedByOther}
                    onChange={e => updateRow(row.requirementId, "status", e.target.value)}
                  >
                    <option value="Open">Open</option>
                    <option value="Closed">Closed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={row.slots}
                    disabled={lockedByOther}
                    onChange={e => updateRow(row.requirementId, "slots", e.target.value)}
                  />
                </td>
                <td>{isWorkable ? row.assignedRecruiter || "" : <span className="non-workable">Non-Workable</span>}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.working}
                    disabled={!isWorkable || lockedByOther}
                    onChange={() => updateRow(row.requirementId, "working", !row.working)}
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
