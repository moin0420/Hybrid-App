import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "./Table.css";

function Table({ userName, requisitionsFromDB, onDataUpdate }) {
  const [requisitions, setRequisitions] = useState([]);

  useEffect(() => setRequisitions(requisitionsFromDB || []), [requisitionsFromDB]);

  const handleWorkingChange = async (req) => {
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ working: !req.working, userName }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.message || "DB Error");
      else onDataUpdate((prev) => prev.map((r) => (r.requirementId === data.requirementId ? data : r)));
    } catch (err) {
      console.error(err);
      toast.error("DB Error");
    }
  };

  const handleEdit = async (e, req, field) => {
    const value = field === "slots" ? parseInt(e.target.value) : e.target.value;
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.message || "DB Update Failed");
      else onDataUpdate((prev) => prev.map((r) => (r.requirementId === data.requirementId ? data : r)));
    } catch (err) {
      console.error(err);
      toast.error("DB Update Failed");
    }
  };

  const handleAddRow = async () => {
    const requirementId = `REQ-${Date.now()}`;
    try {
      const res = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId, client: "", title: "" }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.message || "DB insert failed");
      else onDataUpdate((prev) => [data, ...prev]);
    } catch (err) {
      console.error(err);
      toast.error("DB insert failed");
    }
  };

  return (
    <div className="table-container">
      <div className="table-actions">
        <button className="add-row-btn" onClick={handleAddRow}>Add Row</button>
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
          {requisitions.map((req) => (
            <tr key={req.requirementId}>
              <td>
                <input
                  type="text"
                  value={req.client}
                  disabled={req.working && req.assignedRecruiter !== userName}
                  onChange={(e) => handleEdit(e, req, "client")}
                />
              </td>
              <td>{req.requirementId}</td>
              <td>
                <input
                  type="text"
                  value={req.title}
                  disabled={req.working && req.assignedRecruiter !== userName}
                  onChange={(e) => handleEdit(e, req, "title")}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={req.status}
                  disabled={req.working && req.assignedRecruiter !== userName}
                  onChange={(e) => handleEdit(e, req, "status")}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={req.slots}
                  disabled={req.working && req.assignedRecruiter !== userName}
                  onChange={(e) => handleEdit(e, req, "slots")}
                />
              </td>
              <td>{req.assignedRecruiter}</td>
              <td>
                <input type="checkbox" checked={req.working} onChange={() => handleWorkingChange(req)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
