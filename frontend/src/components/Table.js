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
  const [highlightRows, setHighlightRows] = useState([]); // IDs of recently changed rows

  useEffect(() => {
    setRequisitions(requisitionsFromDB || []);
  }, [requisitionsFromDB]);

  // ---------------------------
  // Highlight a row temporarily
  // ---------------------------
  const flashRow = (id) => {
    setHighlightRows((prev) => [...prev, id]);
    setTimeout(() => {
      setHighlightRows((prev) => prev.filter((rowId) => rowId !== id));
    }, 2000); // Highlight lasts 2 seconds
  };

  // ---------------------------
  // Handle working toggle
  // ---------------------------
  const handleWorkingChange = async (req) => {
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          working: !req.working,
          userName,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(!req.working ? "Assigned successfully" : "Unassigned successfully");
        flashRow(req.id); // highlight updated row
        refreshData();
      } else {
        toast.error(data.message || "Action failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating working status");
    }
  };

  // ---------------------------
  // Handle cell edits
  // ---------------------------
  const handleCellEdit = async (req, field, value) => {
    if (req.assignedRecruiter && req.assignedRecruiter !== userName) return;

    try {
      const updatedRow = { ...req, [field]: value };
      const res = await fetch(`/api/requisitions/update/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedRow),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.message || "Update failed");
      } else {
        flashRow(req.id); // highlight updated row
        refreshData();
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating row");
    }
  };

  // ---------------------------
  // Add blank row
  // ---------------------------
  const handleAddRow = async () => {
    try {
      const res = await fetch("/api/requisitions/new", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("New row added");
        flashRow(data.newRow.id); // highlight new row
        refreshData();
      } else {
        toast.error(data.message || "Failed to add row");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error adding row");
    }
  };

  // ---------------------------
  // Refresh requisitions
  // ---------------------------
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

  // ---------------------------
  // Filter handling
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
    });
  };

  const filteredData = requisitions.filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  return (
    <div className="table-container">
      {/* Filters and Add Row */}
      <div className="table-actions">
        <button className="clear-filters-btn" onClick={clearFilters}>
          Clear All Filters
        </button>
        <button className="add-row-btn" onClick={handleAddRow}>
          Add Row
        </button>
      </div>

      <table className="styled-table">
        <thead>
          <tr>
            <th>
              Requirement ID <br />
              <input
                type="text"
                value={filters.requirementId}
                onChange={(e) => handleFilterChange("requirementId", e.target.value)}
                placeholder="Filter"
              />
            </th>
            <th>
              Client <br />
              <input
                type="text"
                value={filters.client}
                onChange={(e) => handleFilterChange("client", e.target.value)}
                placeholder="Filter"
              />
            </th>
            <th>
              Title <br />
              <input
                type="text"
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
                placeholder="Filter"
              />
            </th>
            <th>
              Status <br />
              <input
                type="text"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                placeholder="Filter"
              />
            </th>
            <th>
              Slots <br />
              <input
                type="number"
                value={filters.slots}
                onChange={(e) => handleFilterChange("slots", e.target.value)}
                placeholder="Filter"
              />
            </th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((req) => (
            <tr
              key={req.id}
              className={highlightRows.includes(req.id) ? "row-highlight" : ""}
            >
              <td>
                <input
                  type="text"
                  value={req.requirementId}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "requirementId", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={req.client}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "client", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={req.title}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "title", e.target.value)}
                />
              </td>
              <td>
                <select
                  value={req.status}
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
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
                  disabled={req.assignedRecruiter && req.assignedRecruiter !== userName}
                  onChange={(e) => handleCellEdit(req, "slots", e.target.value)}
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
