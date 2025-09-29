import React, { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("/");

function App() {
  const [rows, setRows] = useState([]);
  const [userName, setUserName] = useState("");
  const [highlightedRows, setHighlightedRows] = useState([]);

  useEffect(() => {
    const storedName = localStorage.getItem("recruiterName");
    if (storedName) setUserName(storedName);
    else {
      let name = "";
      while (!name) name = prompt("Enter your name:");
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  useEffect(() => fetchRows(), []);

  useEffect(() => {
    socket.on("row-updated", updatedRow => {
      setRows(prev => prev.map(r => r.id === updatedRow.id ? updatedRow : r));
    });
    socket.on("row-added", newRow => {
      setRows(prev => [...prev, newRow]);
      setHighlightedRows(prev => [...prev, newRow.id]);
      setTimeout(() => setHighlightedRows(prev => prev.filter(id => id !== newRow.id)), 2000);
      setTimeout(() => {
        const table = document.querySelector("table tbody");
        const lastRow = table.lastElementChild;
        if (lastRow) lastRow.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    });
  }, []);

  const fetchRows = async () => {
    const res = await axios.get("/api/requisitions");
    setRows(res.data);
  };

  const handleChange = async (id, field, value) => {
    const updatedRows = [...rows];
    const row = updatedRows.find(r => r.id === id);
    const isLockedByOther = row.locked_by && row.locked_by !== userName;
    if (isLockedByOther) return;

    const isWorkable = row.status === "Open" && row.slots > 0;

    if (field === "working") {
      if (!isWorkable) return;
      row.working = !row.working;
      row.assigned_recruiter = row.working ? userName : "";
    } else { row[field] = value; }

    setRows(updatedRows);
    await axios.put(`/api/requisitions/${id}`, { ...row, current_user: userName });
  };

  const addRow = async () => {
    try { await axios.post("/api/requisitions", {}); }
    catch (err) { console.error(err); alert("Error adding new row"); }
  };

  const getStatusColor = status => {
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
            const isLockedByOther = row.locked_by && row.locked_by !== userName;
            return (
              <tr key={row.id} className={
                  highlightedRows.includes(row.id) ? "highlight-row" :
                  isLockedByOther ? "locked-row" :
                  row.locked_by === userName ? "working-row" : ""
                }
                data-user={isLockedByOther ? `Working: ${row.locked_by}` : ""}
              >
                <td><input type="text" value={row.client_name || ""} disabled={isLockedByOther || row.working} onChange={e => handleChange(row.id, "client_name", e.target.value)} /></td>
                <td><input type="text" value={row.requirement_id || ""} disabled={isLockedByOther || row.working} onChange={e => handleChange(row.id, "requirement_id", e.target.value)} /></td>
                <td><input type="text" value={row.job_title || ""} disabled={isLockedByOther || row.working} onChange={e => handleChange(row.id, "job_title", e.target.value)} /></td>
                <td>
                  <select value={row.status || "Open"} disabled={isLockedByOther || row.working} style={{ backgroundColor: getStatusColor(row.status) }} onChange={e => handleChange(row.id, "status", e.target.value)}>
                    <option>Open</option>
                    <option>On hold</option>
                    <option>Filled</option>
                    <option>Closed</option>
                    <option>Cancelled</option>
                  </select>
                </td>
                <td><input type="number" value={row.slots || 0} disabled={isLockedByOther || row.working} onChange={e => handleChange(row.id, "slots", e.target.value)} /></td>
                <td>{isWorkable ? row.assigned_recruiter || "" : "Non-Workable"}</td>
                <td><input type="checkbox" checked={row.working || false} disabled={!isWorkable || isLockedByOther} onChange={() => handleChange(row.id, "working")} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
