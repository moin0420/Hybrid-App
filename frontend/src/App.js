import React from "react";
import Table from "./components/Table";
import "./App.css";

function App() {
  const userName = prompt("Enter your name:"); // simple user identification
  return (
    <div className="App">
      <h1>Recruitment Dashboard</h1>
      <Table userName={userName} />
    </div>
  );
}

export default App;
