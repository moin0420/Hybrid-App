import React, { useEffect, useState, useRef } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

function App() {
  const [userName, setUserName] = useState("");
  const [requisitions, setRequisitions] = useState([]);
  const tableEndRef = useRef(null);

  useEffect(() => {
    const storedName = localStorage.getItem("recruiterName");
    if (storedName) setUserName(storedName);
    else {
      let name = "";
      while (!name) name = prompt("Enter your name:");
      setUserName(name);
      localStorage.setItem("recruiterName", name);
    }
  }, []);

  const fetchRequisitions = async () => {
    try {
      const res = await fetch("/api/requisitions");
      const data = await res.json();
      setRequisitions(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRequisitions();
  }, []);

  useEffect(() => {
    if (tableEndRef.current) tableEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [requisitions]);

  if (!userName) return null;

  return (
    <div className="app-container">
      <h1 className="title">Recruitment Requisitions</h1>
      <Table userName={userName} requisitionsFromDB={requisitions} onDataUpdate={setRequisitions} />
      <div ref={tableEndRef} />
      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
