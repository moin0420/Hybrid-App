import React, { useEffect, useState } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const [userName, setUserName] = useState("");
  const [requisitions, setRequisitions] = useState([]);

  // Initialize recruiter name
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

  // Fetch requisitions initially
  const fetchData = async () => {
    try {
      const res = await fetch("/api/requisitions");
      const data = await res.json();
      setRequisitions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="app-container">
      <h1>Recruitment Requisitions</h1>
      <Table
        userName={userName}
        requisitionsFromDB={requisitions}
        onDataUpdate={setRequisitions}
        refreshData={fetchData}
      />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
