// backend/app.js
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";

dotenv.config();

const { Pool } = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // in production, restrict to your frontend domain
  },
});

// 🔹 DB connection
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }, // Render requires SSL
});

app.use(cors());
app.use(bodyParser.json());

// --------------------
// API ROUTES
// --------------------

// Get all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching requisitions:", err);
    res.status(500).send("Server error");
  }
});

// Add new requisition row
app.post("/api/requisitions", async (req, res) => {
  try {
    const { client_name, requirement_id, job_title, status, slots } = req.body;
    const result = await pool.query(
      `INSERT INTO requisitions (client_name, requirement_id, job_title, status, slots, assigned_recruiter, working) 
       VALUES ($1, $2, $3, $4, $5, '', false) RETURNING *`,
      [client_name, requirement_id, job_title, status, slots]
    );

    const newRow = result.rows[0];
    io.emit("row-added", newRow); // 🔥 Realtime broadcast
    res.json(newRow);
  } catch (err) {
    console.error("❌ Error inserting row:", err);
    res.status(500).send("Server error");
  }
});

// Update a requisition row
app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { client_name, requirement_id, job_title, status, slots, assigned_recruiter, working } = req.body;

    const result = await pool.query(
      `UPDATE requisitions 
       SET client_name=$1, requirement_id=$2, job_title=$3, status=$4, slots=$5, assigned_recruiter=$6, working=$7
       WHERE id=$8 RETURNING *`,
      [client_name, requirement_id, job_title, status, slots, assigned_recruiter, working, id]
    );

    const updatedRow = result.rows[0];
    io.emit("row-updated", updatedRow); // 🔥 Realtime broadcast
    res.json(updatedRow);
  } catch (err) {
    console.error("❌ Error updating row:", err);
    res.status(500).send("Server error");
  }
});

// --------------------
// SERVE FRONTEND BUILD
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const frontendPath = path.join(__dirname, "../frontend/build");
app.use(express.static(frontendPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// --------------------
// START SERVER
// --------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
