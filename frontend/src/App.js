import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [rows, setRows] = useState([]);
  const [userName, setUserName] = useState("");

  // Prompt for user name
  useEffect(() => {
    const storedName = localStorage.getItem("recruiterName");
    if (storedName) {
      setUserName(storedName);
    } else {
      let name = "";
      while (!name) {
        name = prompt("Please enter your name:");
      }
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  useEffect(() => fetchRows(), []);

  const fetchRows = async () => {
    const res = await axios.get("/api/requisitions");
    setRows(res.data);
  };

  const handleChange = async (id, field, value) => {
    const updatedRows = [...rows];
    const row = updatedRows.find(r => r.id === id);

    const isWorkable = row.status === "Open" && row.slots > 0;

    if (field === "working") {
      if (!isWorkable) return;

      if (!row.working) {
        const existing = updatedRows.find(r => r.working);
        if (existing) {
          alert("Another user is already working on a row. Try a different one.");
          return;
        }
        row.working = true;
        row.assigned_recruiter = userName;
      } else {
        row.working = false;
        row.assigned_recruiter = "";
      }
    } else {
      row[field] = value;
    }

    setRows(updatedRows);
    await axios.put(`/api/requisitions/${id}`, { ...row, current_user: userName });
  };

  const addRow = async () => {
    const res = await axios.post("/api/requisitions", {});
    setRows([...rows, res.data]);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Open": return "#28a745";
      case "On hold": return "#ffc107";
      case "Filled": return "#17a2b8";
      case "Closed": return "#6c757d";
      case "Cancelled": return "#dc3545";
      default: return "#007bff";
    }
  };

  return (
    <div className="container">
      <h1>Requisitions Dashboard</h1>
      <button className="add-btn" onClick={addRow}>+ Add Row</button>
      <table>
        <thead>
          <tr>
            <th>Client Name</th>
            <th>Requirement ID</th>
            <th>Job Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const isWorkable = row.status === "Open" && row.slots > 0;
            return (
              <tr key={row.id}>
                <td>
                  <input
                    type="text"
                    value={row.client_name || ""}
                    onChange={e => handleChange(row.id, "client_name", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.requirement_id || ""}
                    onChange={e => handleChange(row.id, "requirement_id", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.job_title || ""}
                    onChange={e => handleChange(row.id, "job_title", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={row.status || "Open"}
                    onChange={e => handleChange(row.id, "status", e.target.value)}
                    style={{ backgroundColor: getStatusColor(row.status), color: "#fff", fontWeight: "bold" }}
                  >
                    <option>Open</option>
                    <option>On hold</option>
                    <option>Filled</option>
                    <option>Closed</option>
                    <option>Cancelled</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={row.slots || 1}
                    min="0"
                    onChange={e => handleChange(row.id, "slots", parseInt(e.target.value) || 0)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={isWorkable ? (row.assigned_recruiter || "") : "Non-Workable"}
                    readOnly
                    className={isWorkable ? "" : "non-workable"}
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.working || false}
                    onChange={() => handleChange(row.id, "working")}
                    disabled={!isWorkable}
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

export default App;
