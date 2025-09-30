import React, { useState, useEffect } from "react";
import Table from "./components/Table";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function App() {
  const [userName, setUserName] = useState("");
  const [chartData, setChartData] = useState([
    { stage: "Applied", count: 20 },
    { stage: "Interview", count: 12 },
    { stage: "Offered", count: 5 },
    { stage: "Hired", count: 3 },
  ]);

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
    <div className="app-container">
      <h1 className="title">Recruitment Requisitions</h1>

      {/* Interactive Bar Chart */}
      <div className="chart-container">
        <h2 className="chart-title">Recruitment Pipeline</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <XAxis dataKey="stage" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#4F46E5" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Table */}
      <Table userName={userName} />

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
}

export default App;
