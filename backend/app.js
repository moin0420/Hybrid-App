import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express + HTTP server + Socket.IO
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

// ✅ PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------------------------------
// API ROUTES
// ---------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Get all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching requisitions:", err);
    res.status(500).json({ error: "Failed to fetch requisitions" });
  }
});

// Add new requisition
app.post("/api/requisitions", async (req, res) => {
  try {
    const { client_name, requirement_id, job_title, status, slots } = req.body;
    const result = await pool.query(
      `INSERT INTO requisitions (client_name, requirement_id, job_title, status, slots)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [client_name, requirement_id, job_title, status, slots]
    );

    const newRow = result.rows[0];
    io.emit("rowAdded", newRow);
    res.json({ success: true, row: newRow });
  } catch (err) {
    console.error("Error adding requisition:", err);
    res.status(500).json({ success: false, error: "Failed to add requisition" });
  }
});

// Update requisition field(s)
app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const fields = req.body;

    const updates = [];
    const values = [];
    let i = 1;

    for (const key in fields) {
      updates.push(`${key} = $${i}`);
      values.push(fields[key]);
      i++;
    }
    values.push(id);

    const query = `UPDATE requisitions SET ${updates.join(", ")} WHERE id = $${i} RETURNING *`;
    const result = await pool.query(query, values);

    const updatedRow = result.rows[0];
    io.emit("rowUpdated", updatedRow);
    res.json(updatedRow);
  } catch (err) {
    console.error("Error updating requisition:", err);
    res.status(500).json({ error: "Failed to update requisition" });
  }
});

// Lock row (Working = true)
app.post("/api/requisitions/:id/lock", async (req, res) => {
  try {
    const { id } = req.params;
    const { recruiter } = req.body;

    const result = await pool.query(
      `UPDATE requisitions
       SET working = true, assigned_recruiter = $1
       WHERE id = $2
       RETURNING *`,
      [recruiter, id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Row not found" });
    }

    const updatedRow = result.rows[0];
    io.emit("rowUpdated", updatedRow);
    res.json({ success: true, row: updatedRow });
  } catch (err) {
    console.error("Error locking row:", err);
    res.status(500).json({ success: false, error: "Failed to lock row" });
  }
});

// Unlock row (Working = false)
app.post("/api/requisitions/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE requisitions
       SET working = false, assigned_recruiter = ''
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Row not found" });
    }

    const updatedRow = result.rows[0];
    io.emit("rowUpdated", updatedRow);
    res.json({ success: true, row: updatedRow });
  } catch (err) {
    console.error("Error unlocking row:", err);
    res.status(500).json({ success: false, error: "Failed to unlock row" });
  }
});

// ---------------------------------
// FRONTEND (React build serving)
// ---------------------------------
app.use(express.static(path.join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// ---------------------------------
// START SERVER
// ---------------------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
