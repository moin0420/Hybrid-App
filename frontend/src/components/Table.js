import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../App.css";

const Table = ({ userName, requisitionsFromDB }) => {
  const [requisitions, setRequisitions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    // Use data from props (from backend/database)
    if (requisitionsFromDB && requisitionsFromDB.length > 0) {
      setRequisitions(requisitionsFromDB);
    }
  }, [requisitionsFromDB]);

  // Sorting function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    const sorted = [...requisitions].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });
    setRequisitions(sorted);
  };

  // Handle working checkbox toggle
  const handleWorkingChange = (index) => {
    const updated = [...requisitions];
    updated[index].working = !updated[index].working;
    updated[index].assignedRecruiter = updated[index].working ? userName : "";
    setRequisitions(updated);
  };

  // Filtered data
  const filteredRequisitions = requisitions.filter((req) =>
    req.client.toLowerCase().includes(filterText.toLowerCase()) ||
    req.title.toLowerCase().includes(filterText.toLowerCase()) ||
    req.requirementId.toLowerCase().includes(filterText.toLowerCase())
  );

  // Status color mapping
  const statusColor = (status) => {
    switch (status) {
      case "Open": return "status-open";
      case "Closed": return "status-closed";
      case "On Hold": return "status-onhold";
      case "Cancelled": return "status-cancelled";
      case "Filled": return "status-filled";
      default: return "";
    }
  };

  return (
    <div className="table-container">
      <div style={{ marginBottom: "1rem" }}>
        <input
          type="text"
          placeholder="Filter by client, title, or ID..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            width: "100%",
            maxWidth: "400px",
            marginBottom: "0.5rem"
          }}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("client")}>Client</th>
            <th onClick={() => handleSort("requirementId")}>Requirement ID</th>
            <th onClick={() => handleSort("title")}>Title</th>
            <th onClick={() => handleSort("status")}>Status</th>
            <th onClick={() => handleSort("slots")}>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {filteredRequisitions.map((req, index) => (
            <tr key={req.requirementId}>
              <td>{req.client}</td>
              <td>{req.requirementId}</td>
              <td>{req.title}</td>
              <td className={statusColor(req.status)}>{req.status}</td>
              <td>{req.slots}</td>
              <td>{req.assignedRecruiter}</td>
              <td>
                <input
                  type="checkbox"
                  checked={req.working}
                  onChange={() => handleWorkingChange(index)}
                />
              </td>
            </tr>
          ))}
          {filteredRequisitions.length === 0 && (
            <tr>
              <td colSpan="7" style={{ textAlign: "center", padding: "1rem" }}>
                No results found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
