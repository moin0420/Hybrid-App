import React, { useState, useEffect } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function App() {
  const [userName, setUserName] = useState("");

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

  if (!userName) return null;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-2xl font-bold text-center mb-6">
        Recruitment Requisitions
      </h1>
      <Table userName={userName} />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
