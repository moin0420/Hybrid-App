import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import axios from "axios";
import "./Table.css";

const socket = io("http://localhost:5000");

const Table = ({ currentUser = "Recruiter A" }) => {
  const [requirements, setRequirements] = useState([]);
  const [filter, setFilter] = useState("");
  const [editingRow, setEditingRow] = useState(null);
  const [editingUsers, setEditingUsers] = useState({});

  useEffect(() => {
    fetchData();

    socket.on("rowUpdated", (updated) => {
      setRequirements((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
    });

    socket.on("fieldUpdated", (data) => {
      setRequirements((prev) =>
        prev.map((r) =>
          r.id === data.id ? { ...r, [data.field]: data.value } : r
        )
      );
    });

    socket.on("editingStart", ({ id, user }) => {
      setEditingUsers((prev) => ({ ...prev, [id]: user }));
    });

    socket.on("editingStop", ({ id }) => {
      setEditingUsers((prev) => {
        const updated = { ...prev };
        delete updated[id];
        return updated;
      });
    });

    return () => {
      socket.off("rowUpdated");
      socket.off("fieldUpdated");
      socket.off("editingStart");
      socket.off("editingStop");
    };
  }, []);

  const fetchData = async () => {
    const res = await axios.get("/api/requirements");
    setRequirements(res.data);
  };

  const handleEdit = (id, field, value) => {
    socket.emit("editField", { id, field, value, user: currentUser });
  };

  const handleFocus = (id) => {
    setEditingRow(id);
    socket.emit("editingStart", { id, user: currentUser });
  };

  const handleBlur = (id) => {
    setEditingRow(null);
    socket.emit("editingStop", { id });
  };

  const handleWorkingToggle = (req) => {
    const recruiter = req.working ? "" : currentUser;
    const working = !req.working;
    socket.emit("toggleWorking", { id: req.id, recruiter, working });
  };

  return (
    <div className="table-container">
      <input
        type="text"
        className="filter-input"
        placeholder="Filter..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      <table className="req-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Role</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Working</th>
            <th>Assigned Recruiter</th>
          </tr>
        </thead>
        <tbody>
          {requirements
            .filter((r) =>
              Object.values(r)
                .join(" ")
                .toLowerCase()
                .includes(filter.toLowerCase())
            )
            .map((req) => {
              const isBeingEdited = editingUsers[req.id];
              const isEditingSelf = editingRow === req.id;

              return (
                <tr
                  key={req.id}
                  className={
                    isEditingSelf
                      ? "editing-self"
                      : isBeingEdited
                      ? "editing-other"
                      : ""
                  }
                >
                  <td>{req.id}</td>
                  <td>
                    <input
                      value={req.client || ""}
                      onChange={(e) =>
                        handleEdit(req.id, "client", e.target.value)
                      }
                      onFocus={() => handleFocus(req.id)}
                      onBlur={() => handleBlur(req.id)}
                    />
                  </td>
                  <td>
                    <input
                      value={req.role || ""}
                      onChange={(e) =>
                        handleEdit(req.id, "role", e.target.value)
                      }
                      onFocus={() => handleFocus(req.id)}
                      onBlur={() => handleBlur(req.id)}
                    />
                  </td>
                  <td>{req.status}</td>
                  <td>{req.slots}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={req.working}
                      onChange={() => handleWorkingToggle(req)}
                      disabled={
                        (req.status !== "Open" || req.slots <= 0) &&
                        !req.working
                      }
                    />
                  </td>
                  <td>
                    {isBeingEdited
                      ? `Editing by ${isBeingEdited}`
                      : req.assigned_recruiter || "Non-Workable"}
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
