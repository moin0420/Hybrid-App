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

  // Initialize local requisitions state
  useEffect(() => {
    setRequisitions(requisitionsFromDB || []);
  }, [requisitionsFromDB]);

  // Handle working checkbox toggle
  const handleWorkingChange = async (req) => {
    const updated = !req.working;
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          working: updated,
          userName,
        }),
      });

      if (res.ok) {
        toast.success(updated ? "Assigned successfully" : "Unassigned successfully");
        // Refresh data
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

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters({ ...filters, [field]: value });
  };

  // Clear all filters
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

  // Filtered rows
  const filteredData = requisitions.filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  return (
    <div className="table-container">
      <div className="table-actions">
        <button className="clear-filters-btn" onClick={clearFilters}>
          Clear All Filters
        </button>
      </div>

      <table className="styled-table">
        <thead>
          <tr>
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
              Requirement ID <br />
              <input
                type="text"
                value={filters.requirementId}
                onChange={(e) => handleFilterChange("requirementId", e.target.value)}
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
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
              >
                <option value="">All</option>
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="On Hold">On Hold</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Filled">Filled</option>
              </select>
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
            <th>
              Assigned Recruiter <br />
              <input
                type="text"
                value={filters.assignedRecruiter}
                onChange={(e) => handleFilterChange("assignedRecruiter", e.target.value)}
                placeholder="Filter"
                disabled
              />
            </th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((req) => (
            <tr key={req.requirementId}>
              <td>{req.client}</td>
              <td>{req.requirementId}</td>
              <td>{req.title}</td>
              <td>
                <span
                  className={
                    req.status === "Open"
                      ? "status-open"
                      : req.status === "Closed"
                      ? "status-closed"
                      : req.status === "On Hold"
                      ? "status-onhold"
                      : req.status === "Cancelled"
                      ? "status-cancelled"
                      : req.status === "Filled"
                      ? "status-filled"
                      : ""
                  }
                >
                  {req.status}
                </span>
              </td>
              <td>{req.slots}</td>
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
