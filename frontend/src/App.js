import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const [userName, setUserName] = useState("");
  const [requisitions, setRequisitions] = useState([]);

  // Get recruiter name from localStorage or prompt
  useEffect(() => {
    const storedName = localStorage.getItem("recruiterName");
    if (storedName) {
      setUserName(storedName);
    } else {
      let name = "";
      while (!name) {
        name = prompt("Please enter your name:");
      }
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  // Fetch requisitions from backend
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/requisitions");
        if (!res.ok) throw new Error("Failed to fetch requisitions");
        const data = await res.json();
        // Ensure correct fields
        const normalized = data.map((r) => ({
          client: r.client ?? "",
          requirementId: r.requirementId ?? r.requirement_id ?? "",
          title: r.title ?? "",
          status: r.status ?? "Open",
          slots: Number.isFinite(r.slots) ? r.slots : Number(r.slots) || 0,
          assignedRecruiter: r.assignedRecruiter ?? r.assigned_recruiter ?? "",
          working: Boolean(r.working),
        }));
        setRequisitions(normalized);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  if (!userName) return null;

  return (
    <div className="app-container">
      <h1 className="title">Recruitment Requisitions</h1>

      <Table
        userName={userName}
        requisitionsFromDB={requisitions}
        onDataUpdate={(newList) => setRequisitions(newList)}
      />

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
