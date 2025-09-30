import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(bodyParser.json());

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// 🔹 Get all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching requisitions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Add a new row
app.post("/api/requisitions", async (req, res) => {
  const { client_name, requirement_id, job_title, status, slots } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO requisitions (client_name, requirement_id, job_title, status, slots, assigned_recruiter, working)
       VALUES ($1, $2, $3, $4, $5, '', false)
       RETURNING *`,
      [client_name, requirement_id, job_title, status, slots]
    );
    io.emit("rowAdded", result.rows[0]);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("❌ Error adding row:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Update a row field
app.put("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const fields = Object.keys(updates)
      .map((field, idx) => `${field} = $${idx + 1}`)
      .join(", ");

    const values = Object.values(updates);
    values.push(id);

    const result = await pool.query(
      `UPDATE requisitions SET ${fields} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Row not found" });
    }

    io.emit("rowUpdated", result.rows[0]);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating row:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Lock row (Working checkbox)
app.post("/api/requisitions/:id/lock", async (req, res) => {
  const { id } = req.params;
  const { recruiter } = req.body;

  try {
    // Check if recruiter already has another active row
    const existing = await pool.query(
      "SELECT * FROM requisitions WHERE assigned_recruiter = $1 AND working = true AND id != $2",
      [recruiter, id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "You already have a row checked. Uncheck it before selecting another.",
      });
    }

    // Lock this row
    const result = await pool.query(
      "UPDATE requisitions SET working = true, assigned_recruiter = $1 WHERE id = $2 RETURNING *",
      [recruiter, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Row not found" });
    }

    io.emit("rowUpdated", result.rows[0]);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("❌ Error locking row:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 🔹 Unlock row
app.post("/api/requisitions/:id/unlock", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "UPDATE requisitions SET working = false, assigned_recruiter = '' WHERE id = $1 RETURNING *",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Row not found" });
    }

    io.emit("rowUpdated", result.rows[0]);
    res.json({ success: true, row: result.rows[0] });
  } catch (err) {
    console.error("❌ Error unlocking row:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
