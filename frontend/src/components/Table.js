// frontend/src/components/Table.js
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./Table.css";

const socket = io("/");

function Table({ currentUser }) {
  const [rows, setRows] = useState([]);
  const typingTimersRef = useRef({});
  const [localEdits, setLocalEdits] = useState({});

  useEffect(() => {
    fetchRows();
    socket.on("requisitions_updated", (data) => {
      setRows(data);
      setLocalEdits({});
    });
    return () => socket.off("requisitions_updated");
  }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFieldChange = (requirementId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.requirementId === requirementId ? { ...r, [field]: value } : r))
    );

    setLocalEdits((prev) => ({
      ...prev,
      [requirementId]: { ...(prev[requirementId] || {}), [field]: value },
    }));

    const key = `${requirementId}::${field}`;
    if (typingTimersRef.current[key]) clearTimeout(typingTimersRef.current[key]);
    typingTimersRef.current[key] = setTimeout(async () => {
      try {
        await axios.put(`/api/requisitions/${requirementId}`, { [field]: value });
      } catch (err) {
        console.error("Update failed:", err);
        alert(err.response?.data?.message || "Update failed");
        fetchRows();
      } finally {
        delete typingTimersRef.current[key];
      }
    }, 550);
  };

  const toggleWorking = async (row) => {
    if (row.status !== "Open" || row.slots <= 0) return;

    const alreadyWorking = rows.find(
      (r) => r.working && r.assignedRecruiter === currentUser && r.requirementId !== row.requirementId
    );
    if (!row.working && alreadyWorking) {
      alert("You're already working on another requirement. Please free it to start working on this req.");
      return;
    }

    try {
      await axios.put(`/api/requisitions/${row.requirementId}`, {
        working: !row.working,
        userName: currentUser,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Working toggle failed");
      fetchRows();
    }
  };

  const addRow = async () => {
    const newReqId = `REQ-${Date.now()}`;
    try {
      await axios.post("/api/requisitions", {
        requirementId: newReqId,
        client: "",
        title: "",
        status: "Open",
        slots: 1,
      });
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Add row failed");
    }
  };

  const isLockedByOther = (row) =>
    row.working && row.assignedRecruiter && row.assignedRecruiter !== currentUser;

  return (
    <div className="table-container">
      <div className="table-actions">
        <button onClick={addRow}>Add Row</button>
        <input placeholder="Filter..." onChange={() => {}} />
      </div>

      <table className="req-table">
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
          {rows.map((row) => {
            const locked = isLockedByOther(row);
            return (
              <tr
                key={row.requirementId}
                className={locked ? "locked" : row.working && row.assignedRecruiter === currentUser ? "working-current" : ""}
              >
                <td>
                  <input type="text" value={row.requirementId} disabled />
                </td>
                <td>
                  <input
                    value={row.client ?? ""}
                    disabled={locked}
                    onChange={(e) => handleFieldChange(row.requirementId, "client", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.title ?? ""}
                    disabled={locked}
                    onChange={(e) => handleFieldChange(row.requirementId, "title", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={row.status ?? ""}
                    disabled={locked}
                    onChange={(e) => handleFieldChange(row.requirementId, "status", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={row.slots ?? 0}
                    disabled={locked}
                    onChange={(e) => handleFieldChange(row.requirementId, "slots", Number(e.target.value))}
                  />
                </td>
                <td>
                  {row.working ? row.assignedRecruiter || "" : (row.status !== "Open" || row.slots <= 0 ? "Non-Workable" : "")}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={Boolean(row.working && row.assignedRecruiter === currentUser)}
                    disabled={
                      (row.status !== "Open" || row.slots <= 0) ||
                      (row.working && row.assignedRecruiter !== currentUser)
                    }
                    onChange={() => toggleWorking(row)}
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

export default Table;
