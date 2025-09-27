import React, { useEffect, useState } from "react";
import axios from "axios";

const App = () => {
  const [data, setData] = useState([]);
  const [filters, setFilters] = useState({});

  const user = "currentUser"; // Replace with login user info

  const fetchData = async () => {
    const res = await axios.get("http://localhost:5000/requisitions");
    setData(res.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilter = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const filteredData = data.filter((row) =>
    Object.keys(filters).every((key) =>
      String(row[key]).toLowerCase().includes(
        (filters[key] || "").toLowerCase()
      )
    )
  );

  const handleWorkingChange = async (id, value, assignedRecruiter) => {
    try {
      await axios.post(
        `http://localhost:5000/requisitions/${id}/update`,
        { working: value, assignedRecruiter, user }
      );
      fetchData();
    } catch (err) {
      alert(err.response.data.error);
    }
  };

  return (
    <div className="container">
      <h1>Requisitions Table</h1>
      <table>
        <thead>
          <tr>
            {data[0] &&
              Object.keys(data[0]).map((key) => (
                <th key={key}>
                  {key}
                  <br />
                  <input
                    placeholder={`Filter ${key}...`}
                    onChange={(e) => handleFilter(key, e.target.value)}
                  />
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row) => (
            <tr key={row.id}>
              {Object.keys(row).map((key) => (
                <td key={key}>
                  {key === "working" ? (
                    <input
                      value={row[key]}
                      onChange={(e) =>
                        handleWorkingChange(
                          row.id,
                          e.target.value,
                          row.assignedRecruiter
                        )
                      }
                    />
                  ) : (
                    row[key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default App;
