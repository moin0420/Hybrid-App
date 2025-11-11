
import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import Table from "./components/Table.jsx";
import "./App.css";

function App() {
  const tableRef = useRef();
  const [currentUser, setCurrentUser] = useState("");
  const [newReq, setNewReq] = useState({
    requirementId: "",
    title: "",
    client: "",
    slots: 1,
    status: "Open",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    let user = localStorage.getItem("recruiterName");
    if (!user) {
      user = prompt("Enter your name:");
      if (user) localStorage.setItem("recruiterName", user);
    }
    setCurrentUser(user || "Anonymous");
  }, []);

  const handleAddRow = async () => {
    if (
      !newReq.requirementId.trim() ||
      !newReq.title.trim() ||
      !newReq.client.trim()
    ) {
      setError("Please enter Requirement ID, Job Title, and Client name");
      setTimeout(() => setError(""), 4000);
      return;
    }

    try {
      await axios.post("/api/requisitions", newReq);
      setNewReq({
        requirementId: "",
        title: "",
        client: "",
        slots: 1,
        status: "Open",
      });
      tableRef.current?.fetchRows();
    } catch (err) {
      console.error(err);
      setError("Error adding new requisition");
      setTimeout(() => setError(""), 4000);
    }
  };

  return (
    <>
      <header className="mb-4">
        <div className="text-sm text-gray-600">
          Logged in as: <span className="font-semibold">{currentUser}</span>
        </div>
      </header>

      {error && (
        <div className={`error-message ${error ? "" : "fade-out"}`}>
          {error}
        </div>
      )}

      <div className="add-req-container">
        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Requirement ID
          </label>
          <input
            className="border p-1 rounded w-40"
            value={newReq.requirementId}
            onChange={(e) =>
              setNewReq({ ...newReq, requirementId: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Job Title
          </label>
          <input
            className="border p-1 rounded w-48"
            value={newReq.title}
            onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Client
          </label>
          <input
            className="border p-1 rounded w-48"
            value={newReq.client}
            onChange={(e) => setNewReq({ ...newReq, client: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Slots
          </label>
          <input
            type="number"
            className="border p-1 rounded w-20 text-center"
            min="1"
            value={newReq.slots}
            onChange={(e) =>
              setNewReq({ ...newReq, slots: Number(e.target.value) })
            }
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Status
          </label>
          <select
            className="border p-1 rounded"
            value={newReq.status}
            onChange={(e) => setNewReq({ ...newReq, status: e.target.value })}
          >
            <option>Open</option>
            <option>Closed</option>
            <option>On Hold</option>
            <option>Filled</option>
            <option>Cancelled</option>
          </select>
        </div>

        <button className="add-req-btn" onClick={handleAddRow}>
          + Add Requirement
        </button>
      </div>

      {/* 🧊 Frosted Glass Background only for the Table */}
      <div className="main-container">
        <Table ref={tableRef} />
      </div>
    </>
  );
}

export default App;
