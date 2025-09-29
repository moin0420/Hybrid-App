import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [rows, setRows] = useState([]);
  const currentUser = "User1"; // Replace with login logic if needed

  useEffect(() => fetchRows(), []);

  const fetchRows = async () => {
    const res = await axios.get("/api/requisitions");
    setRows(res.data);
  };

  const handleChange = async (id, field, value) => {
    const updatedRows = [...rows];
    const row = updatedRows.find(r => r.id === id);

    if (field === "working") {
      if (!row.working) { // Trying to check
        const existing = updatedRows.find(r => r.working);
        if (existing) {
          alert("Another user is already working on a requisition. Please try a different one.");
          return;
        }
        row.working = true;
        row.assigned_recruiter = currentUser;
      } else { // Unchecking
        row.working = false;
        row.assigned_recruiter = "";
      }
    } else {
      row[field] = value;
    }

    setRows(updatedRows);
    await axios.put(`/api/requisitions/${id}`, row);
  };

  const addRow = async () => {
    const res = await axios.post("/api/requisitions", {});
    setRows([...rows, res.data]);
  };

  return (
    <div className="container">
      <h1>Requisitions</h1>
      <button onClick={addRow}>Add Row</button>
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
          {rows.map(row => (
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
                  onChange={e => handleChange(row.id, "slots", parseInt(e.target.value) || 1)}
                />
              </td>
              <td>
                <input type="text" value={row.assigned_recruiter || ""} readOnly />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={row.working || false}
                  onChange={() => handleChange(row.id, "working")}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default App;
