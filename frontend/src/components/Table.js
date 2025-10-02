import React, { useState } from "react";

function Table({ rows, updateRow, toggleWorking }) {
  const [editingRow, setEditingRow] = useState(null);
  const [currentUser] = useState("Moin"); // TODO: replace with real logged-in user

  const handleEdit = (row) => {
    setEditingRow({ ...row });
  };

  const handleSave = (requirementId) => {
    updateRow(requirementId, editingRow);
    setEditingRow(null);
  };

  const handleChange = (field, value) => {
    setEditingRow((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <table border="1" cellPadding="8" style={{ width: "100%" }}>
      <thead>
        <tr>
          <th>Requirement ID</th>
          <th>Client</th>
          <th>Title</th>
          <th>Status</th>
          <th>Slots</th>
          <th>Assigned Recruiter</th>
          <th>Working</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isEditing = editingRow?.requirementId === row.requirementId;
          return (
            <tr key={row.requirementId}>
              <td>{row.requirementId}</td>

              <td>
                {isEditing ? (
                  <input
                    value={editingRow.client}
                    onChange={(e) => handleChange("client", e.target.value)}
                  />
                ) : (
                  row.client
                )}
              </td>

              <td>
                {isEditing ? (
                  <input
                    value={editingRow.title}
                    onChange={(e) => handleChange("title", e.target.value)}
                  />
                ) : (
                  row.title
                )}
              </td>

              <td>
                {isEditing ? (
                  <input
                    value={editingRow.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  />
                ) : (
                  row.status
                )}
              </td>

              <td>
                {isEditing ? (
                  <input
                    type="number"
                    value={editingRow.slots}
                    onChange={(e) => handleChange("slots", e.target.value)}
                  />
                ) : (
                  row.slots
                )}
              </td>

              <td>{row.assignedRecruiter}</td>

              <td>
                <input
                  type="checkbox"
                  checked={row.working}
                  disabled={row.working && row.assignedRecruiter !== currentUser}
                  onChange={(e) =>
                    toggleWorking(row.requirementId, e.target.checked, currentUser)
                  }
                />
              </td>

              <td>
                {isEditing ? (
                  <button onClick={() => handleSave(row.requirementId)}>
                    Save
                  </button>
                ) : (
                  <button onClick={() => handleEdit(row)}>Edit</button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default Table;
