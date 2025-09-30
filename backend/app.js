import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import pkg from "pg";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Database connection
const pool = new Pool({
  connectionString: process.env.DB_URL,
});

// ✅ New friendly root route
app.get("/", (req, res) => {
  res.send("✅ Backend is running! Use /api/requisitions to fetch data.");
});

// API: Get all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching requisitions:", err);
    res.status(500).send("Server error");
  }
});

// API: Add a new requisition row
app.post("/api/requisitions", async (req, res) => {
  try {
    const { client_name, requirement_id, job_title, status, slots } = req.body;
    const result = await pool.query(
      `INSERT INTO requisitions 
        (client_name, requirement_id, job_title, status, slots, assigned_recruiter, working) 
        VALUES ($1, $2, $3, $4, $5, '', false) RETURNING *`,
      [client_name, requirement_id, job_title, status, slots]
    );
    io.emit("row-added", result.rows[0]); // 🔥 broadcast to all users
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error adding requisition:", err);
    res.status(500).send("Server error");
  }
});

// API: Update a requisition
app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client_name, requirement_id, job_title, status, slots, assigned_recruiter, working } =
      req.body;

    const result = await pool.query(
      `UPDATE requisitions SET 
        client_name = $1,
        requirement_id = $2,
        job_title = $3,
        status = $4,
        slots = $5,
        assigned_recruiter = $6,
        working = $7
      WHERE id = $8 RETURNING *`,
      [client_name, requirement_id, job_title, status, slots, assigned_recruiter, working, id]
    );

    if (result.rows.length > 0) {
      io.emit("row-updated", result.rows[0]); // 🔥 broadcast to all users
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating requisition:", err);
    res.status(500).send("Server error");
  }
});

// Fallback: serve React app
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// WebSockets
io.on("connection", (socket) => {
  console.log("🔌 New client connected");
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
