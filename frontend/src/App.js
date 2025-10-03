import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { io } from "socket.io-client";

function App() {
  const [userName, setUserName] = useState("");
  const [requisitions, setRequisitions] = useState([]);

  // Initialize recruiter name
  useEffect(() => {
    const storedName = localStorage.getItem("recruiterName");
    if (storedName) setUserName(storedName);
    else {
      let name = "";
      while (!name) name = prompt("Please enter your name:");
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  // Fetch requisitions
  useEffect(() => {
    fetch("/api/requisitions")
      .then((res) => res.json())
      .then((data) => setRequisitions(data))
      .catch((err) => console.error(err));
  }, []);

  // Socket.IO
  useEffect(() => {
    const socket = io();
    socket.on("rowUpdated", (row) => {
      setRequisitions((prev) => {
        const idx = prev.findIndex((r) => r.requirementId === row.requirementId);
        if (idx >= 0) {
          const newList = [...prev];
          newList[idx] = row;
          return newList;
        } else return [row, ...prev];
      });
    });
    socket.on("rowAdded", (row) => setRequisitions((prev) => [row, ...prev]));
    return () => socket.disconnect();
  }, []);

  if (!userName) return null;

  return (
    <div className="app-container">
      <h1 className="title">Recruitment Requisitions</h1>
      <Table userName={userName} requisitionsFromDB={requisitions} onDataUpdate={setRequisitions} />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
