import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { io } from "socket.io-client";

function App() {
  const [userName, setUserName] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const [socket, setSocket] = useState(null);

  // ---------------------------
  // Initialize recruiter name
  // ---------------------------
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

  // ---------------------------
  // Fetch requisitions initially
  // ---------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/requisitions");
        if (!res.ok) throw new Error("Failed to fetch requisitions");
        const data = await res.json();
        setRequisitions(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, []);

  // ---------------------------
  // Socket.IO Setup
  // ---------------------------
  useEffect(() => {
    const newSocket = io(); // automatically connects to backend origin
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("✅ Connected to Socket.IO server:", newSocket.id);
    });

    // Listen for row updates
    newSocket.on("rowUpdated", (updatedRow) => {
      setRequisitions((prev) => {
        const idx = prev.findIndex(
          (r) => r.requirementId === updatedRow.requirementId
        );
        if (idx >= 0) {
          const newList = [...prev];
          newList[idx] = updatedRow;
          return newList;
        } else {
          return [updatedRow, ...prev];
        }
      });
    });

    // Listen for seeding event (refresh everything)
    newSocket.on("rowsSeeded", async () => {
      try {
        const res = await fetch("/api/requisitions");
        const data = await res.json();
        setRequisitions(data);
      } catch (err) {
        console.error("Failed to refresh after seeding:", err);
      }
    });

    return () => {
      newSocket.disconnect();
    };
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
