import React, { useState, useEffect } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./App.css";

const socket = io();

function App() {
  const [rows, setRows] = useState([]);
  const [username, setUsername] = useState(localStorage.getItem("username") || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!username) {
      const name = prompt("Enter your name:");
      if (name) {
        setUsername(name);
        localStorage.setItem("username", name);
      }
    }

    fetchRows();

    socket.on("row-updated", (updatedRow) => {
      setRows((prev) =>
        prev.map((row) => (row.id === updatedRow.id ? updatedRow : row))
      );
    });

    socket.on("row-added", (newRow) => {
      setRows((prev) => [...prev, newRow]);
    });

    return () => {
      socket.off("row-updated");
      socket.off("row-added");
    };
  }, [username]);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error("❌ Error fetching rows:", err);
      setError("Error fetching data from server. Please refresh.");
    }
  };

  const handleChange = async (id, field, value) => {
    try {
      const updatedRows = [...rows];
      const rowIndex = updatedRows.findIndex((r) => r.id === id);
      const row = { ...updatedRows[rowIndex], [field]: value };

      // Business logic: working lock
      if (field === "working") {
        if (row.working) {
          row.assigned_recruiter = username;
        } else {
          row.assigned_recruiter = "";
        }
      }

      updatedRows[rowIndex] = row;
      setRows(updatedRows);

      await axios.put(`/api/requisitions/${id}`, row);
      setError("");
    } catch (err) {
      console.error("❌ Error saving changes:", err);
      setError("Error saving changes. Try again.");
    }
  };

  const addRow = async () => {
    try {
      const newRow = {
        client_name: "",
        requirement_id: "",
        job_title: "",
        status: "Open",
        slots: 1,
      };
      const res = await axios.post("/api/requisitions", newRow);
      setRows((prev) => [...prev, res.data]);
      setError("");
    } catch (err) {
      console.error("❌ Error adding row:", err);
      setError("Error adding new row. Try again.");
    }
  };

  return (
    <div className="container">
      <h1>Requisitions</h1>

      {/* 🔴 Error Banner */}
      {error && <div className="error-banner">{error}</div>}

      <button className="add-btn" onClick={addRow}>
        ➕ Add Row
      </button>

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
          {rows.map((row) => {
            const isWorkable = row.status === "Open" && row.slots > 0;
            const isLockedByOther =
              row.working && row.assigned_recruiter !== username;

            return (
              <tr
                key={row.id}
                className={
                  isLockedByOther
                    ? "locked-row"
                    : row.assigned_recruiter === username
                    ? "my-row"
                    : ""
                }
              >
                <td>
                  <input
                    type="text"
                    value={row.client_name}
                    onChange={(e) =>
                      handleChange(row.id, "client_name", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.requirement_id}
                    onChange={(e) =>
                      handleChange(row.id, "requirement_id", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={row.job_title}
                    onChange={(e) =>
                      handleChange(row.id, "job_title", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td>
                  <select
                    value={row.status}
                    onChange={(e) =>
                      handleChange(row.id, "status", e.target.value)
                    }
                    disabled={isLockedByOther}
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
                    min="0"
                    value={row.slots}
                    onChange={(e) =>
                      handleChange(row.id, "slots", parseInt(e.target.value))
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    value={isWorkable ? row.assigned_recruiter : "Non-Workable"}
                    disabled
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.working || false}
                    onChange={() =>
                      handleChange(row.id, "working", !row.working)
                    }
                    disabled={!isWorkable || isLockedByOther}
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
