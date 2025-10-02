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
    assignedRecruiter: "",
  });

  const [requisitions, setRequisitions] = useState([]);
  const [newRow, setNewRow] = useState({
    requirementId: "",
    client: "",
    title: "",
    status: "Open",
    slots: 0,
  });

  // Initialize local requisitions state
  useEffect(() => {
    setRequisitions(requisitionsFromDB || []);
  }, [requisitionsFromDB]);

  // ---------------------------
  // Handle working checkbox toggle
  // ---------------------------
  const handleWorkingChange = async (req) => {
    const updated = !req.working;
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ working: updated, userName }),
      });

      if (res.ok) {
        toast.success(updated ? "Assigned successfully" : "Unassigned successfully");
        const refreshed = await fetch("/api/requisitions").then((r) => r.json());
        setRequisitions(refreshed);
        onDataUpdate(refreshed);
      } else {
        const errData = await res.json();
        toast.error(errData.message || "Update failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating requisition");
    }
  };

  // ---------------------------
  // Handle inline edit for existing rows
  // ---------------------------
  const handleCellEdit = async (req, field, value) => {
    try {
      const updatedRow = { ...req, [field]: value };
      const res = await fetch(`/api/requisitions/update/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client: updatedRow.client,
          title: updatedRow.title,
          status: updatedRow.status,
          slots: updatedRow.slots,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Row updated successfully");
        const refreshed = await fetch("/api/requisitions").then((r) => r.json());
        setRequisitions(refreshed);
        onDataUpdate(refreshed);
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating row");
    }
  };

  // ---------------------------
  // Handle adding new row
  // ---------------------------
  const handleAddRow = async () => {
    if (!newRow.requirementId || !newRow.client || !newRow.title || !newRow.status) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      const res = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Row added successfully");
        const refreshed = await fetch("/api/requisitions").then((r) => r.json());
        setRequisitions(refreshed);
        onDataUpdate(refreshed);
        setNewRow({ requirementId: "", client: "", title: "", status: "Open", slots: 0 });
      } else {
        toast.error(data.message || "Failed to add row");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adding row");
    }
  };

  // ---------------------------
  // Filter handlers
  // ---------------------------
  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  const clearFilters = () => {
    setFilters({
      client: "",
      requirementId: "",
      title: "",
      status: "",
      slots: "",
      assignedRecruiter: "",
    });
  };

  const filteredData = requisitions.filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  return (
    <div className="table-container">
      {/* Add Row Form */}
      <div className="add-row-form">
        <input
          type="text"
          placeholder="Requirement ID"
          value={newRow.requirementId}
          onChange={(e) => setNewRow({ ...newRow, requirementId: e.target.value })}
        />
        <input
          type="text"
          placeholder="Client"
          value={newRow.client}
          onChange={(e) => setNewRow({ ...newRow, client: e.target.value })}
        />
        <input
          type="text"
          placeholder="Title"
          value={newRow.title}
          onChange={(e) => setNewRow({ ...newRow, title: e.target.value })}
        />
        <select
          value={newRow.status}
          onChange={(e) => setNewRow({ ...newRow, status: e.target.value })}
        >
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
          <option value="On Hold">On Hold</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Filled">Filled</option>
        </select>
        <input
          type="number"
          placeholder="Slots"
          value={newRow.slots}
          onChange={(e) => setNewRow({ ...newRow, slots: Number(e.target.value) })}
        />
        <button onClick={handleAddRow}>Add Row</button>
      </div>

      <div className="table-actions">
        <button className="clear-filters-btn" onClick={clearFilters}>
          Clear All Filters
        </button>
      </div>

      <table className="styled-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Requirement ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((req) => (
            <tr key={req.requirementId}>
              <td>
                <input
                  type="text"
                  value={req.client}
                  onChange={(e) => handleCellEdit(req, "client", e.target.value)}
                />
              </td>
              <td>{req.requirementId}</td>
              <td>
                <input
                  type="text"
                  value={req.title}
                  onChange={(e) => handleCellEdit(req, "title", e.target.value)}
                />
              </td>
              <td>
                <select
                  value={req.status}
                  onChange={(e) => handleCellEdit(req, "status", e.target.value)}
                >
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                  <option value="On Hold">On Hold</option>
                  <option value="Cancelled">Cancelled</option>
                  <option value="Filled">Filled</option>
                </select>
              </td>
              <td>
                <input
                  type="number"
                  value={req.slots}
                  onChange={(e) => handleCellEdit(req, "slots", Number(e.target.value))}
                />
              </td>
              <td>{req.assignedRecruiter}</td>
              <td>
                <input
                  type="checkbox"
                  checked={req.working}
                  onChange={() => handleWorkingChange(req)}
                />
              </td>
            </tr>
          ))}
          {filteredData.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No requisitions found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
