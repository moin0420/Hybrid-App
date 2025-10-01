import React, { useState } from "react";

function Table({ requisitions, onDataUpdate }) {
  const [filters, setFilters] = useState({
    client: "",
    requirementId: "",
    title: "",
    status: "",
    slots: "",
    assignedRecruiter: "",
    working: "",
  });

  // Handle filter input
  const handleFilterChange = (col, value) => {
    setFilters((prev) => ({ ...prev, [col]: value }));
  };

  // Handle working checkbox toggle
  const handleWorkingToggle = (index, checked) => {
    const username = "Current User"; // Replace with logged-in username if available
    const updated = [...requisitions];
    updated[index] = {
      ...updated[index],
      working: checked,
      assignedRecruiter: checked ? username : "",
    };
    onDataUpdate(updated);
  };

  // Apply filters
  const filteredData = requisitions.filter((r) => {
    return (
      (!filters.client ||
        r.client?.toLowerCase().includes(filters.client.toLowerCase())) &&
      (!filters.requirementId ||
        r.requirementId
          ?.toString()
          .toLowerCase()
          .includes(filters.requirementId.toLowerCase())) &&
      (!filters.title ||
        r.title?.toLowerCase().includes(filters.title.toLowerCase())) &&
      (!filters.status ||
        r.status?.toLowerCase().includes(filters.status.toLowerCase())) &&
      (!filters.slots ||
        r.slots?.toString().includes(filters.slots.toString())) &&
      (!filters.assignedRecruiter ||
        r.assignedRecruiter
          ?.toLowerCase()
          .includes(filters.assignedRecruiter.toLowerCase())) &&
      (!filters.working ||
        (filters.working === "yes" && r.working) ||
        (filters.working === "no" && !r.working))
    );
  });

  if (!Array.isArray(requisitions)) {
    return <p>No data</p>;
  }

  return (
    <div className="table-container">
      <table className="styled-table">
        <thead>
          <tr>
            <th>Client</th>
            <th>Requirement ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Slots</th>
            <th>Assigned Recruiter</th>
            <th>Working</th>
          </tr>
          <tr>
            <th>
              <input
                type="text"
                value={filters.client}
                onChange={(e) => handleFilterChange("client", e.target.value)}
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                value={filters.requirementId}
                onChange={(e) =>
                  handleFilterChange("requirementId", e.target.value)
                }
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                value={filters.title}
                onChange={(e) => handleFilterChange("title", e.target.value)}
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                value={filters.slots}
                onChange={(e) => handleFilterChange("slots", e.target.value)}
                placeholder="Filter..."
              />
            </th>
            <th>
              <input
                type="text"
                value={filters.assignedRecruiter}
                onChange={(e) =>
                  handleFilterChange("assignedRecruiter", e.target.value)
                }
                placeholder="Filter..."
                disabled
              />
            </th>
            <th>
              <select
                value={filters.working}
                onChange={(e) => handleFilterChange("working", e.target.value)}
              >
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredData.length > 0 ? (
            filteredData.map((r, idx) => (
              <tr key={idx}>
                <td>{r.client || "-"}</td>
                <td>{r.requirementId || "-"}</td>
                <td>{r.title || "-"}</td>
                <td>{r.status || "Open"}</td>
                <td>{r.slots ?? 0}</td>
                <td>{r.assignedRecruiter || "-"}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={r.working || false}
                    onChange={(e) => handleWorkingToggle(idx, e.target.checked)}
                  />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" style={{ textAlign: "center" }}>
                No matching records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
