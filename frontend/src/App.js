// frontend/src/App.js
import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import { io } from "socket.io-client";
import "./App.css";

const socket = io("/");

function App() {
  const [userName, setUserName] = useState("");
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem("recruiterName");
    let name = stored;
    if (!stored) {
      while (!name) {
        name = prompt("Please enter your name (how you want to appear to others):");
        if (!name) alert("Name required");
      }
      localStorage.setItem("recruiterName", name);
    }
    setUserName(name);

    socket.emit("user_joined", name);

    socket.on("online_users", (users) => {
      setOnlineUsers(users);
    });

    return () => {
      socket.off("online_users");
    };
  }, []);

  if (!userName) return null;

  return (
    <div className="App">
      <h1>Requirements List</h1>
      <div className="online-users">
        Online Users: {onlineUsers.join(", ")}
      </div>
      <Table currentUser={userName} socket={socket} />
    </div>
  );
}

export default App;
