import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import "../App.css";

const Table = ({ userName }) => {
  const [requisitions, setRequisitions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  // Sample data – replace with your API call if needed
  useEffect(() => {
    const data = [
      { id: 1, position: "Software Engineer", location: "NY", status: "Applied" },
      { id: 2, position: "Data Analyst", location: "CA", status: "Interview" },
      { id: 3, position: "Product Manager", location: "TX", status: "Offered" },
      { id: 4, position: "UX Designer", location: "WA", status: "Hired" },
    ];
    setRequisitions(data);
  }, []);

  // Sort function
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    const sorted = [...requisitions].sort((a, b) => {
      if (a[key] < b[key]) return direction === "asc" ? -1 : 1;
      if (a[key] > b[key]) return direction === "asc" ? 1 : -1;
      return 0;
    });
    setRequisitions(sorted);
  };

  // Toast example
  const handleClick = (position) => {
    toast.info(`${userName}, you clicked on ${position}`);
  };

  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th onClick={() => handleSort("id")}>ID</th>
            <th onClick={() => handleSort("position")}>Position</th>
            <th onClick={() => handleSort("location")}>Location</th>
            <th onClick={() => handleSort("status")}>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {requisitions.map((req) => (
            <tr key={req.id}>
              <td>{req.id}</td>
              <td>{req.position}</td>
              <td>{req.location}</td>
              <td>{req.status}</td>
              <td>
                <button
                  className="action-btn"
                  onClick={() => handleClick(req.position)}
                >
                  Notify
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
