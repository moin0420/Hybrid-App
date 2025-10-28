import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import Table from "./components/Table.jsx";
import "./App.css";

function App() {
  const tableRef = useRef();
  const [currentUser, setCurrentUser] = useState("");
  const [error, setError] = useState(""); // 🔹 Inline error state
  const [newReq, setNewReq] = useState({
    requirementId: "",
    title: "",
    client: "",
    slots: 1,
    status: "Open",
  });

  // === Ask user name on first visit ===
  useEffect(() => {
    let user = localStorage.getItem("recruiterName");
    if (!user) {
      user = prompt("Enter your name:");
      if (user) localStorage.setItem("recruiterName", user);
    }
    setCurrentUser(user || "Anonymous");
  }, []);

  // === Add new requisition ===
  const handleAddRow = async () => {
    setError(""); // Clear previous error
    if (
      !newReq.requirementId.trim() ||
      !newReq.title.trim() ||
      !newReq.client.trim()
    ) {
      setError("Please fill all mandatory fields — Requirement ID, Job Title, and Client.");
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
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Error adding new requisition. Please try again.");
      }
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 text-gray-800">
      <header className="mb-4">
        <div className="text-sm text-gray-600">
          Logged in as: <span className="font-semibold">{currentUser}</span>
        </div>
      </header>

      <div className="add-req-container">
        {/* === Requirement ID === */}
        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Requirement ID <span className="text-red-500">*</span>
          </label>
          <input
            className={`border p-1 rounded w-40 ${
              error && !newReq.requirementId ? "border-red-400 bg-red-50" : ""
            }`}
            value={newReq.requirementId}
            onChange={(e) =>
              setNewReq({ ...newReq, requirementId: e.target.value })
            }
          />
          {/* 🔹 Inline Error Message */}
          {error && (
            <div className="text-red-500 text-xs mt-1 w-64">{error}</div>
          )}
        </div>

        {/* === Job Title === */}
        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Job Title <span className="text-red-500">*</span>
          </label>
          <input
            className={`border p-1 rounded w-48 ${
              error && !newReq.title ? "border-red-400 bg-red-50" : ""
            }`}
            value={newReq.title}
            onChange={(e) => setNewReq({ ...newReq, title: e.target.value })}
          />
        </div>

        {/* === Client === */}
        <div>
          <label className="block text-xs font-semibold text-gray-600">
            Client <span className="text-red-500">*</span>
          </label>
          <input
            className={`border p-1 rounded w-48 ${
              error && !newReq.client ? "border-red-400 bg-red-50" : ""
            }`}
            value={newReq.client}
            onChange={(e) => setNewReq({ ...newReq, client: e.target.value })}
          />
        </div>

        {/* === Slots === */}
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

        {/* === Status === */}
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

      <Table ref={tableRef} />
    </div>
  );
}

export default App;
