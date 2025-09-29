// frontend/src/App.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./App.css"; // keep the filename you actually have

function App() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    fetchRows();
  }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error("Failed to fetch rows", err);
    }
  };

  const handleChange = async (id, field, value) => {
    // make a new rows array (immutable update)
    const updatedRows = rows.map(r => (r.id === id ? { ...r } : r));
    const row = updatedRows.find(r => r.id === id);
    if (!row) return;

    if (field === "working") {
      const valLower = typeof value === "string" ? value.toLowerCase() : "";
      if (valLower === "yes") {
        const existing = updatedRows.find(
          r => r.id !== id && typeof r.working === "string" && r.working.toLowerCase() === "yes"
        );
        if (existing) {
          alert("You're already working on another requisition. Please mark it free and try again.");
          return;
        }
      }
      row.working = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      if (value.toLowerCase() !== "yes") {
        row.assigned_recruiter = "";
      }
    } else {
      row.assigned_recruiter = value;
    }

    setRows(updatedRows);

    try {
      await axios.put(`/api/requisitions/${id}`, row);
    } catch (err) {
      console.error("Failed to update", err);
      // Optionally: reload rows from server to resync
      fetchRows();
    }
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
                  value={row.working || ""}
                  onChange={e => handleChange(row.id, "working", e.target.value)}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={row.assigned_recruiter || ""}
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
