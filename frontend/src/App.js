// frontend/src/App.js
import React, { useRef, useState, useEffect } from "react";
import axios from "axios";
import Table from "./components/Table.jsx";
import "./App.css";

function App() {
  const tableRef = useRef();
  const [currentUser, setCurrentUser] = useState("");
  const [newReq, setNewReq] = useState({
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
    if (!newReq.title.trim() || !newReq.client.trim()) {
      alert("Please enter Job Title and Client name");
      return;
    }

    try {
      await axios.post("/api/requisitions", newReq);
      setNewReq({ title: "", client: "", slots: 1, status: "Open" });
      tableRef.current?.fetchRows();
    } catch (err) {
      console.error(err);
      alert("Error adding new requisition");
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 text-gray-800">
      <header className="mb-4">
        <div className="text-sm text-gray-600">
          Logged in as: <span className="font-semibold">{currentUser}</span>
        </div>
      </header>

      <div className="flex items-end gap-2 mb-6 bg-white p-3 rounded-lg shadow">
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
            onChange={(e) =>
              setNewReq({ ...newReq, status: e.target.value })
            }
          >
            <option>Open</option>
            <option>Closed</option>
            <option>On Hold</option>
            <option>Filled</option>
            <option>Cancelled</option>
          </select>
        </div>

        <button
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
          onClick={handleAddRow}
        >
          Add Requirement
        </button>
      </div>

      <Table ref={tableRef} />
    </div>
  );
}

export default App;
