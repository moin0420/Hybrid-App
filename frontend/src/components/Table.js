import React, { useState, useEffect } from "react";
import "../App.css";
import "./Table.css";
import { toast } from "react-toastify";

function Table({ userName, requisitionsFromDB, onDataUpdate, refreshData }) {
  const [requisitions, setRequisitions] = useState([]);
  const [filters, setFilters] = useState({
    client: "",
    requirementId: "",
    title: "",
    status: "",
    slots: "",
    assignedRecruiter: "",
  });

  useEffect(() => {
    setRequisitions(requisitionsFromDB);
  }, [requisitionsFromDB]);

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

  const handleEdit = async (req, field, value) => {
    try {
      const payload = { ...req, [field]: value };
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "DB Update Failed");
      } else {
        await refreshData();
      }
    } catch (err) {
      console.error(err);
      toast.error("DB Update Failed");
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
      if (!res.ok) toast.error(data.message || "DB Error");
      await refreshData();
    } catch (err) {
      console.error(err);
      toast.error("DB Error");
    }
  };

  const addRow = async () => {
    try {
      const res = await fetch("/api/requisitions", { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.message || "DB insert failed");
        return;
      }
      const newRow = await res.json();
      onDataUpdate([newRow, ...requisitions]);
    } catch (err) {
      console.error(err);
      toast.error("DB insert failed");
    }
  };

  const filteredData = requisitions.filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field]).toLowerCase().includes(value.toLowerCase()) : true
    )
  );

  return (
    <div className="table-container">
      <div className="table-actions">
        <button onClick={addRow}>Add Row</button>
        <button onClick={clearFilters}>Clear Filters</button>
      </div>
      <table className="styled-table">
        <thead>
          <tr>
            <th>
              Client
              <input
                value={filters.client}
                onChange={(e) => handleFilterChange("client", e.target.value)}
              />
            </th>
            <th>
              Requirement ID
              <input
                value={filters.requirementId}
                onChange={(e) => handleFilterChange("requirementId", e.target.value)}
              />
            </th>
            <th>
              Title
              <input
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
              />
            </th>
            <th>
              Status
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
              Slots
              <input
                type="number"
                value={filters.slots}
                onChange={(e) => handleFilterChange("slots", e.target.value)}
              />
            </th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((req) => (
            <tr key={req.requirementId}>
              <td>
                <input
                  disabled={req.working && req.assignedRecruiter !== userName}
                  value={req.client}
                  onChange={(e) => handleEdit(req, "client", e.target.value)}
                />
              </td>
              <td>{req.requirementId}</td>
              <td>
                <input
                  disabled={req.working && req.assignedRecruiter !== userName}
                  value={req.title}
                  onChange={(e) => handleEdit(req, "title", e.target.value)}
                />
              </td>
              <td>
                <select
                  disabled={req.working && req.assignedRecruiter !== userName}
                  value={req.status}
                  onChange={(e) => handleEdit(req, "status", e.target.value)}
                >
                  <option value="">Select</option>
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
                  disabled={req.working && req.assignedRecruiter !== userName}
                  value={req.slots}
                  onChange={(e) => handleEdit(req, "slots", parseInt(e.target.value))}
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
