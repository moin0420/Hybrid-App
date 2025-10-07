import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./Table.css";

const socket = io("/"); // or full URL if deployed

const userName = "User_" + Math.floor(Math.random() * 1000);

const Table = () => {
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    // Initial fetch
    socket.emit("requestRows");
    // Listen for updates
    socket.on("updateRows", (data) => setRows(data));
    socket.on("errorMsg", (msg) => alert(msg));
    return () => {
      socket.off("updateRows");
      socket.off("errorMsg");
    };
  }, []);

  const addRow = () => socket.emit("addRow");

  const updateField = (row, field, value) => {
    const updatedRow = { ...row, [field]: value, userName };
    socket.emit("editRow", updatedRow);
  };

  const handleWorkingChange = (row) => {
    socket.emit("editRow", { ...row, working: !row.working, userName });
  };

  const isLocked = (row) => row.working && row.assignedRecruiter !== userName;

  return (
    <div className="table-container">
      <div className="table-actions">
        <button onClick={addRow}>Add Row</button>
        <input
          placeholder="Filter..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <table>
        <thead>
          <tr>
            <th>Requirement ID</th>
            <th>Client</th>
            <th>Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((r) =>
              r.client.toLowerCase().includes(filter.toLowerCase()) ||
              r.title.toLowerCase().includes(filter.toLowerCase()) ||
              r.requirementId.toLowerCase().includes(filter.toLowerCase())
            )
            .map((row) => (
              <tr key={row.requirementId} className={isLocked(row) ? "locked" : ""}>
                <td>
                  <input
                    value={row.requirementId}
                    disabled={row.requirementId && row.requirementId !== ""}
                  />
                </td>
                <td>
                  <input
                    value={row.client}
                    disabled={isLocked(row)}
                    onChange={(e) => updateField(row, "client", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.title}
                    disabled={isLocked(row)}
                    onChange={(e) => updateField(row, "title", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.status}
                    disabled={isLocked(row)}
                    onChange={(e) => updateField(row, "status", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.slots}
                    disabled={isLocked(row)}
                    onChange={(e) => updateField(row, "slots", Number(e.target.value))}
                  />
                </td>
                <td>
                  <input
                    value={row.working ? row.assignedRecruiter : ""}
                    disabled
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.working && row.assignedRecruiter === userName}
                    disabled={
                      row.status !== "Open" ||
                      row.slots <= 0 ||
                      (row.working && row.assignedRecruiter !== userName)
                    }
                    onChange={() => handleWorkingChange(row)}
                  />
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
