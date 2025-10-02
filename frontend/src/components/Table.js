import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../App.css";

function Table({ userName, requisitionsFromDB, onDataUpdate }) {
  const [filters, setFilters] = useState({
    client: "",
    requirementId: "",
    title: "",
    status: "",
    slots: "",
  });
  const [requisitions, setRequisitions] = useState([]);
  const [highlightRows, setHighlightRows] = useState([]);

  useEffect(() => setRequisitions(requisitionsFromDB || []), [requisitionsFromDB]);

  const flashRow = (id) => {
    setHighlightRows((prev) => [...prev, id]);
    setTimeout(() => setHighlightRows((prev) => prev.filter((x) => x !== id)), 2000);
  };

  const refreshData = async () => {
    try {
      const res = await fetch("/api/requisitions");
      const data = await res.json();
      setRequisitions(data);
      onDataUpdate(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleWorkingChange = async (req) => {
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ working: !req.working, userName }),
      });
      const data = await res.json();
      if (res.ok) flashRow(req.id);
      else toast.error(data.message || "Action failed");
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("Error updating working status");
    }
  };

  const handleCellEdit = async (req, field, value) => {
    if (req.assignedRecruiter && req.assignedRecruiter !== userName) return;
    const updatedRow = { ...req, [field]: value };
    try {
      const res = await fetch(`/api/requisitions/update/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRow),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || "Update failed");
      } else flashRow(req.id);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("DB update failed");
    }
  };

  const handleAddRow = async () => {
    try {
      const res = await fetch("/api/requisitions/new", { method: "POST" });
      const data = await res.json();
      if (res.ok) flashRow(data.newRow.id);
      refreshData();
    } catch (err) {
      console.error(err);
      toast.error("DB insert failed");
    }
  };

  const handleFilterChange = (field, value) => setFilters({ ...filters, [field]: value });
  const clearFilters = () =>
    setFilters({ client: "", requirementId: "", title: "", status: "", slots: "" });

  const filteredData = requisitions.filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  return (
    <div className="table-container">
      <div className="table-actions">
        <button className="clear-filters-btn" onClick={clearFilters}>Clear All Filters</button>
        <button className="add-row-btn" onClick={handleAddRow}>Add Row</button>
      </div>

      <table className="styled-table">
        <thead>
          <tr>
            <th>Requirement ID</th>
            <th>Client</th>
            <th>Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((req) => (
            <tr key={req.id} className={highlightRows.includes(req.id) ? "row-highlight" : ""}>
              <td>
                <input type="text" value={req.requirementId}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "requirementId", e.target.value)} />
              </td>
              <td>
                <input type="text" value={req.client}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "client", e.target.value)} />
              </td>
              <td>
                <input type="text" value={req.title}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "title", e.target.value)} />
              </td>
              <td>
                <select value={req.status}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "status", e.target.value)}>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Filled">Filled</option>
                </select>
              </td>
              <td>
                <input type="number" value={req.slots}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "slots", e.target.value)} />
              </td>
              <td>{req.assignedRecruiter}</td>
              <td>
                <input type="checkbox" checked={req.working} onChange={() => handleWorkingChange(req)} />
              </td>
            </tr>
          ))}
          {filteredData.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>No requisitions found</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
