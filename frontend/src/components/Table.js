import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import "./Table.css";

const socket = io("/");

function Table({ currentUser }) {
  const [rows, setRows] = useState([]);
  const typingTimersRef = useRef({});
  const [editingUsers, setEditingUsers] = useState({});
  const maxSlots = 10; // Max slots for progress bar visualization

  useEffect(() => {
    fetchRows();

    socket.on("requisitions_updated", (data) => {
      setRows(data.map((r) => ({ ...r, currentId: r.requirementId })));
    });

    socket.on("editing", ({ requirementId, field, value, userName }) => {
      if (userName === currentUser) return;
      setRows((prev) =>
        prev.map((r) =>
          r.requirementId === requirementId ? { ...r, [field]: value } : r
        )
      );
      setEditingUsers((prev) => ({ ...prev, [requirementId]: userName }));
    });

    socket.on("editing_stopped", ({ requirementId }) => {
      setEditingUsers((prev) => {
        const copy = { ...prev };
        delete copy[requirementId];
        return copy;
      });
    });

    return () => {
      socket.off("requisitions_updated");
      socket.off("editing");
      socket.off("editing_stopped");
    };
  }, []);

  const fetchRows = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data.map((r) => ({ ...r, currentId: r.requirementId })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFieldChange = (requirementId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.requirementId === requirementId ? { ...r, [field]: value } : r))
    );

    socket.emit("editing", { requirementId, field, value, userName: currentUser });

    const key = `${requirementId}::${field}`;
    if (typingTimersRef.current[key]) clearTimeout(typingTimersRef.current[key]);

    typingTimersRef.current[key] = setTimeout(async () => {
      try {
        const row = rows.find((r) => r.requirementId === requirementId);
        const urlId = row?.currentId || requirementId;

        if (field === "requirementId") {
          await axios.put(`/api/requisitions/${urlId}`, { newRequirementId: value });
          setRows((prev) =>
            prev.map((r) =>
              r.requirementId === urlId
                ? { ...r, currentId: value, requirementId: value }
                : r
            )
          );
        } else {
          await axios.put(`/api/requisitions/${urlId}`, { [field]: value });
        }

        socket.emit("editing_stopped", { requirementId });
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
      (r) =>
        r.working && r.assignedRecruiter === currentUser && r.requirementId !== row.requirementId
    );
    if (!row.working && alreadyWorking) {
      alert(
        "You're already working on another requirement. Please free it to start working on this req."
      );
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

  const getInputWidth = (value) => {
    const length = value ? value.length : 1;
    return `${Math.max(length * 8, 60)}px`;
  };

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
            const locked = isLockedByOther(row) || editingUsers[row.requirementId];
            return (
              <tr
                key={row.id}
                className={
                  locked
                    ? "locked"
                    : editingUsers[row.requirementId]
                    ? "editing-row"
                    : row.working && row.assignedRecruiter === currentUser
                    ? "working-current"
                    : ""
                }
              >
                {/* Requirement ID */}
                <td>
                  <input
                    type="text"
                    value={row.requirementId}
                    disabled={locked}
                    style={{ width: getInputWidth(row.requirementId) }}
                    onChange={(e) =>
                      handleFieldChange(row.requirementId, "requirementId", e.target.value)
                    }
                  />
                  {editingUsers[row.requirementId] &&
                    editingUsers[row.requirementId] !== currentUser && (
                      <small>Editing by {editingUsers[row.requirementId]}</small>
                    )}
                </td>

                {/* Client */}
                <td>
                  <input
                    type="text"
                    value={row.client ?? ""}
                    disabled={locked}
                    style={{ width: getInputWidth(row.client) }}
                    onChange={(e) => handleFieldChange(row.requirementId, "client", e.target.value)}
                  />
                </td>

                {/* Title */}
                <td>
                  <input
                    type="text"
                    value={row.title ?? ""}
                    disabled={locked}
                    style={{ width: getInputWidth(row.title) }}
                    onChange={(e) => handleFieldChange(row.requirementId, "title", e.target.value)}
                  />
                </td>

                {/* Status */}
                <td>
                  <span className={`status-badge status-${row.status}`}>
                    {row.status}
                  </span>
                </td>

                {/* Slots as progress bar */}
                <td>
                  <div className="slot-bar">
                    <div
                      className="slot-fill"
                      style={{
                        width: `${Math.min((row.slots / maxSlots) * 100, 100)}%`,
                      }}
                    ></div>
                  </div>
                </td>

                {/* Assigned Recruiter */}
                <td>
                  {row.assignedRecruiter && <span className="badge">{row.assignedRecruiter}</span>}
                </td>

                {/* Working */}
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
