import React, { useState, useEffect } from "react";
import io from "socket.io-client";
import { toast } from "react-toastify";

const socket = io();

export default function Table({ userName }) {
  const [data, setData] = useState([]);
  const [newRow, setNewRow] = useState({
    client_name: "",
    requirement_id: "",
    job_title: "",
    status: "Open",
    slots: 1,
  });

  useEffect(() => {
    fetch("/api/requisitions")
      .then((res) => res.json())
      .then((rows) => setData(rows))
      .catch(() => toast.error("Error fetching data from server."));

    socket.on("rowUpdated", (updatedRow) => {
      setData((prev) =>
        prev.map((row) => (row.id === updatedRow.id ? updatedRow : row))
      );
    });

    socket.on("rowAdded", (addedRow) => {
      setData((prev) => [...prev, addedRow]);
    });

    return () => {
      socket.off("rowUpdated");
      socket.off("rowAdded");
    };
  }, []);

  const handleInputChange = (id, field, value) => {
    setData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      )
    );

    fetch(`/api/requisitions/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value, recruiter: userName }),
    }).catch(() => toast.error("Error saving changes."));
  };

  const handleCheckboxChange = async (row) => {
    if (!userName) {
      toast.error("Please enter your name first.");
      return;
    }

    if (!row.working) {
      const alreadyChecked = data.find(
        (r) => r.assigned_recruiter === userName && r.working === true
      );
      if (alreadyChecked && alreadyChecked.id !== row.id) {
        toast.error("You already have one row locked. Uncheck it first.");
        return;
      }
    }

    try {
      const url = row.working
        ? `/api/requisitions/${row.id}/unlock`
        : `/api/requisitions/${row.id}/lock`;

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruiter: userName }),
      });

      const result = await res.json();
      if (!result.success) {
        toast.error(result.message || "Error updating row.");
      } else {
        toast.success("Row updated successfully!");
      }
    } catch {
      toast.error("Error saving changes. Try again.");
    }
  };

  const handleAddRow = async () => {
    try {
      const res = await fetch("/api/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRow),
      });

      const result = await res.json();
      if (result.success) {
        setNewRow({
          client_name: "",
          requirement_id: "",
          job_title: "",
          status: "Open",
          slots: 1,
        });
        toast.success("New row added!");
      } else {
        toast.error("Error adding row.");
      }
    } catch {
      toast.error("Error adding row.");
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      {/* Add Row Form */}
      <div className="flex gap-2 mb-4">
        <input
          className="border p-2 rounded flex-1"
          placeholder="Client Name"
          value={newRow.client_name}
          onChange={(e) =>
            setNewRow({ ...newRow, client_name: e.target.value })
          }
        />
        <input
          className="border p-2 rounded flex-1"
          placeholder="Requirement ID"
          value={newRow.requirement_id}
          onChange={(e) =>
            setNewRow({ ...newRow, requirement_id: e.target.value })
          }
        />
        <input
          className="border p-2 rounded flex-1"
          placeholder="Job Title"
          value={newRow.job_title}
          onChange={(e) =>
            setNewRow({ ...newRow, job_title: e.target.value })
          }
        />
        <select
          className="border p-2 rounded"
          value={newRow.status}
          onChange={(e) => setNewRow({ ...newRow, status: e.target.value })}
        >
          <option>Open</option>
          <option>On hold</option>
          <option>Filled</option>
          <option>Closed</option>
          <option>Cancelled</option>
        </select>
        <input
          type="number"
          className="border p-2 rounded w-20"
          value={newRow.slots}
          onChange={(e) =>
            setNewRow({ ...newRow, slots: parseInt(e.target.value) })
          }
        />
        <button
          onClick={handleAddRow}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Add Row
        </button>
      </div>

      {/* Table */}
      <table className="min-w-full border">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Client Name</th>
            <th className="p-2 border">Requirement ID</th>
            <th className="p-2 border">Job Title</th>
            <th className="p-2 border">Status</th>
            <th className="p-2 border">Slots</th>
            <th className="p-2 border">Assigned Recruiter</th>
            <th className="p-2 border">Working</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const isNonWorkable =
              row.status !== "Open" || parseInt(row.slots) <= 0;
            const isLockedByOther =
              row.working && row.assigned_recruiter !== userName;

            return (
              <tr
                key={row.id}
                className={`${
                  isLockedByOther ? "bg-gray-100" : "bg-white"
                } border-t`}
              >
                <td className="p-2 border">
                  <input
                    className="w-full"
                    value={row.client_name || ""}
                    onChange={(e) =>
                      handleInputChange(row.id, "client_name", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td className="p-2 border">
                  <input
                    className="w-full"
                    value={row.requirement_id || ""}
                    onChange={(e) =>
                      handleInputChange(row.id, "requirement_id", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td className="p-2 border">
                  <input
                    className="w-full"
                    value={row.job_title || ""}
                    onChange={(e) =>
                      handleInputChange(row.id, "job_title", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td className="p-2 border">
                  <select
                    value={row.status || "Open"}
                    onChange={(e) =>
                      handleInputChange(row.id, "status", e.target.value)
                    }
                    disabled={isLockedByOther}
                  >
                    <option>Open</option>
                    <option>On hold</option>
                    <option>Filled</option>
                    <option>Closed</option>
                    <option>Cancelled</option>
                  </select>
                </td>
                <td className="p-2 border">
                  <input
                    type="number"
                    className="w-full"
                    value={row.slots || 0}
                    onChange={(e) =>
                      handleInputChange(row.id, "slots", e.target.value)
                    }
                    disabled={isLockedByOther}
                  />
                </td>
                <td className="p-2 border">
                  {isNonWorkable
                    ? "Non-Workable"
                    : row.assigned_recruiter || ""}
                </td>
                <td className="p-2 border text-center">
                  <input
                    type="checkbox"
                    checked={row.working || false}
                    onChange={() => handleCheckboxChange(row)}
                    disabled={isNonWorkable || isLockedByOther}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
