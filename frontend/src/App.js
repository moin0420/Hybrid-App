// frontend/src/App.js
import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import "./App.css";

function App() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("recruiterName");
    if (stored) {
      setUserName(stored);
      return;
    }
    let name = "";
    while (!name) {
      name = prompt("Please enter your name (how you want to appear to others):");
      if (!name) alert("Name required");
    }
    localStorage.setItem("recruiterName", name);
    setUserName(name);
  }, []);

  if (!userName) return null;

  return (
    <div className="App">
      <h1>Requisitions</h1>
      <Table currentUser={userName} />
    </div>
  );
}

export default App;
