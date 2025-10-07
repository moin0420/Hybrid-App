import React, { useEffect, useState } from "react";
import axios from "axios";
import io from "socket.io-client";
import "./Table.css";

const socket = io.connect("/");

const Table = () => {
  const [rows, setRows] = useState([]);
  const [localEdit, setLocalEdit] = useState({});
  const [editingCell, setEditingCell] = useState(null);

  useEffect(() => {
    fetchData();

    socket.on("requisitionUpdated", ({ id, column, value }) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [column]: value } : r))
      );
    });

    socket.on("editingCell", (data) => setEditingCell(data));
    socket.on("editingStopped", () => setEditingCell(null));

    return () => {
      socket.off("requisitionUpdated");
      socket.off("editingCell");
      socket.off("editingStopped");
    };
  }, []);

  const fetchData = async () => {
    try {
      const res = await axios.get("/api/requisitions");
      setRows(res.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const handleChange = (id, column, value) => {
    setLocalEdit((prev) => ({
      ...prev,
      [id]: { ...prev[id], [column]: value },
    }));
  };

  const handleBlur = async (id, column) => {
    const value = localEdit[id]?.[column];
    if (value === undefined) return;

    try {
      await axios.put(`/api/requisitions/${id}`, { column, value });
      socket.emit("requisitionUpdated", { id, column, value });
    } catch (err) {
      console.error("Error updating:", err);
    }
    socket.emit("stopEditing");
  };

  const handleFocus = (id, column) => {
    socket.emit("startEditing", { id, column });
    setEditingCell({ id, column });
  };

  return (
    <div className="table-container">
      <h2>Live Requisitions</h2>
      <table className="req-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Recruiter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              {["id", "client", "title", "status", "slots", "assigned_recruiter"].map((col) => (
                <td
                  key={col}
                  className={
                    editingCell?.id === r.id && editingCell?.column === col
                      ? "editing"
                      : ""
                  }
                >
                  <input
                    type="text"
                    value={localEdit[r.id]?.[col] ?? r[col] ?? ""}
                    onChange={(e) => handleChange(r.id, col, e.target.value)}
                    onBlur={() => handleBlur(r.id, col)}
                    onFocus={() => handleFocus(r.id, col)}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
