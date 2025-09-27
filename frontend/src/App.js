import React, { useState, useEffect } from "react";
import axios from "axios";
import "./app.css";

function App() {
  const [rows, setRows] = useState([]);

  useEffect(() => fetchRows(), []);

  const fetchRows = async () => {
    const res = await axios.get("/api/requisitions");
    setRows(res.data);
  };

  const handleChange = async (id, field, value) => {
    const updatedRows = [...rows];
    const row = updatedRows.find(r => r.id === id);

    if (field === "working") {
      if (value.toLowerCase() === "yes") {
        const existing = updatedRows.find(r => r.working.toLowerCase() === "yes");
        if (existing && existing.id !== id) {
          alert("You're already working on another requisition. Please mark it free and try again.");
          return;
        }
      }
      row.working = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      row.assigned_recruiter = value.toLowerCase() !== "yes" ? "" : row.assigned_recruiter;
    } else row.assigned_recruiter = value;

    setRows(updatedRows);
    await axios.put(`/api/requisitions/${id}`, row);
  };

  return (
    <div className="container">
      <h1>Requisitions</h1>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Working</th>
            <th>Assigned Recruiter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>
                <input
                  type="text"
                  value={row.working}
                  onChange={e => handleChange(row.id, "working", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.assigned_recruiter}
                  onChange={e => handleChange(row.id, "assigned_recruiter", e.target.value)}
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
