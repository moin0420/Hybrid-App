import React, { useState, useEffect } from "react";
import Table from "./components/Table";
import "./App.css";
import { io } from "socket.io-client";

function App() {
  const [currentUser, setCurrentUser] = useState("");
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let name = localStorage.getItem("recruiterName");
    if (!name) {
      name = prompt("Enter your name:");
      localStorage.setItem("recruiterName", name);
    }
    setCurrentUser(name);
  }, []);

  useEffect(() => {
    const s = io();
    setSocket(s);
    return () => s.disconnect();
  }, []);

  if (!currentUser) return null;

  return (
    <div className="App">
      <h1>Requirements Tracker</h1>
      <Table currentUser={currentUser} socket={socket} />
    </div>
  );
}

export default App;
