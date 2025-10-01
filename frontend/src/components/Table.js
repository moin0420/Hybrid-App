import React, { useState } from "react";
import { toast } from "react-toastify";
import "../App.css";

function Table({ userName, requisitionsFromDB = [], onDataUpdate }) {
  const [filters, setFilters] = useState({
    client: "",
    requirementId: "",
    title: "",
    status: "",
    slots: "",
    assignedRecruiter: "",
  });

  const handleWorkingChange = async (req) => {
    try {
      const res = await fetch(`/api/requisitions/${req.requirementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ working: !req.working, userName }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        const updated = requisitionsFromDB.map((r) =>
          r.requirementId === req.requirementId
            ? { ...r, working: !r.working, assignedRecruiter: !r.working ? userName : "" }
            : r
        );
        onDataUpdate(updated);
      } else {
        toast.error(data.message || "Update failed");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error updating requisition");
    }
  };

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

  const filteredData = (requisitionsFromDB || []).filter((row) =>
    Object.entries(filters).every(([field, value]) =>
      value ? String(row[field] ?? "").toLowerCase().includes(value.toLowerCase()) : true
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
            {["client","requirementId","title","status","slots","assignedRecruiter"].map((col) => (
              <th key={col}>
                {col.charAt(0).toUpperCase() + col.slice(1)}<br />
                {col === "status" ? (
                  <select value={filters[col]} onChange={(e) => handleFilterChange(col,e.target.value)}>
                    <option value="">All</option>
                    {["Open","Closed","On Hold","Cancelled","Filled"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input type={col==="slots"?"number":"text"} value={filters[col]} onChange={(e)=>handleFilterChange(col,e.target.value)} placeholder="Filter"/>
                )}
              </th>
            ))}
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length === 0 ? (
            <tr><td colSpan="7" style={{textAlign:"center"}}>No requisitions found</td></tr>
          ) : filteredData.map((req) => (
            <tr key={req.requirementId}>
              <td>{req.client}</td>
              <td>{req.requirementId}</td>
              <td>{req.title}</td>
              <td>
                <span className={
                  req.status==="Open"?"status-open":
                  req.status==="Closed"?"status-closed":
                  req.status==="On Hold"?"status-onhold":
                  req.status==="Cancelled"?"status-cancelled":
                  req.status==="Filled"?"status-filled":""
                }>{req.status}</span>
              </td>
              <td>{req.slots}</td>
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
