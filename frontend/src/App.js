import React, { useState, useEffect } from "react";
import Table from "./components/Table";

function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch rows on load
  useEffect(() => {
    fetch("http://localhost:5000/api/requisitions")
      .then((res) => res.json())
      .then((data) => {
        setRows(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Fetch error:", err);
        setLoading(false);
      });
  }, []);

  // Add new row (blank row created in DB first)
  const addRow = async () => {
    try {
      const requirementId = "REQ-" + Date.now();
      const res = await fetch("http://localhost:5000/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requirementId }),
      });

      if (!res.ok) throw new Error("Insert failed");

      const newRow = await res.json();
      setRows((prev) => [...prev, newRow]);
    } catch (err) {
      console.error("❌ Add Row failed:", err);
    }
  };

  // Update row (inline edit save)
  const updateRow = async (requirementId, updatedRow) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/requisitions/${requirementId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedRow),
        }
      );

      if (!res.ok) throw new Error("Update failed");

      const updated = await res.json();
      setRows((prev) =>
        prev.map((row) =>
          row.requirementId === requirementId ? updated : row
        )
      );
    } catch (err) {
      console.error("❌ Update failed:", err);
    }
  };

  // Toggle working status
  const toggleWorking = async (requirementId, checked, recruiterName) => {
    try {
      const res = await fetch(
        `http://localhost:5000/api/requisitions/${requirementId}/working`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ working: checked, recruiterName }),
        }
      );

      if (!res.ok) throw new Error("Toggle failed");

      const updated = await res.json();
      setRows((prev) =>
        prev.map((row) =>
          row.requirementId === requirementId ? updated : row
        )
      );
    } catch (err) {
      console.error("❌ Toggle failed:", err);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="app-container">
      <h1>Recruitment Tracker</h1>
      <button onClick={addRow}>Add Row</button>
      <Table rows={rows} updateRow={updateRow} toggleWorking={toggleWorking} />
    </div>
  );
}

export default App;
