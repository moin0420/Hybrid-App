import React, { useState, useEffect } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { io } from "socket.io-client";

function App() {
  const [userName, setUserName] = useState("");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("recruiterName");
    if (stored) setUserName(stored);
    else {
      let name = "";
      while (!name) name = prompt("Enter your name:");
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  useEffect(() => {
    const s = io(); 
    setSocket(s);
    return () => s.disconnect();
  }, []);

  if (!userName) return null;

  return (
    <div className="app-container">
      <h1>Recruitment Requisitions</h1>
      <Table currentUser={userName} socket={socket} />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
