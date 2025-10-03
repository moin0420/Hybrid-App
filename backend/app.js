import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketIO } from "socket.io";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIO(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT"] },
});

app.use(cors());
app.use(bodyParser.json());

// PostgreSQL Pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize table
const initTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requisitions (
        id SERIAL PRIMARY KEY,
        requirement_id TEXT UNIQUE,
        client TEXT,
        title TEXT,
        status TEXT,
        slots INTEGER DEFAULT 0,
        assigned_recruiter TEXT DEFAULT '',
        working BOOLEAN DEFAULT FALSE
      );
    `);
    console.log("✅ Table initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize table:", err);
  }
};
initTable();

// Map DB row to frontend
const mapRow = (row) => ({
  requirementId: row.requirement_id,
  client: row.client,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assigned_recruiter || "",
  working: row.working,
});

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);
  socket.on("disconnect", () => console.log("❌ Client disconnected:", socket.id));
});

// GET all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id DESC");
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB read error" });
  }
});

// POST add new row
app.post("/api/requisitions", async (req, res) => {
  const { requirementId, client, title, status, slots } = req.body;
  if (!requirementId || !client || !title) return res.status(400).json({ message: "requirementId, client, title required" });

  try {
    const result = await pool.query(
      `INSERT INTO requisitions
       (requirement_id, client, title, status, slots)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [requirementId, client, title, status || "", slots || 0]
    );
    const createdRow = mapRow(result.rows[0]);
    io.emit("rowAdded", createdRow);
    res.status(201).json(createdRow);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// PUT update row
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { client, title, status, slots, working, userName } = req.body;

  try {
    const result = await pool.query("SELECT * FROM requisitions WHERE requirement_id=$1", [requirementId]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    // Handle working assignment/unassignment
    if (typeof working === "boolean" && typeof userName === "string") {
      const currentAssigned = row.assigned_recruiter || "";
      if (working) {
        if (currentAssigned && currentAssigned !== "") return res.status(409).json({ message: `Already assigned to ${currentAssigned}` });
        await pool.query("UPDATE requisitions SET working=TRUE, assigned_recruiter=$1 WHERE requirement_id=$2", [userName, requirementId]);
      } else {
        if (!currentAssigned || currentAssigned === "") return res.status(200).json({ message: "Already unassigned" });
        if (currentAssigned !== userName) return res.status(409).json({ message: `Cannot unassign; assigned to ${currentAssigned}` });
        await pool.query("UPDATE requisitions SET working=FALSE, assigned_recruiter='' WHERE requirement_id=$1", [requirementId]);
      }
      const updatedRow = await pool.query("SELECT * FROM requisitions WHERE requirement_id=$1", [requirementId]);
      const mappedRow = mapRow(updatedRow.rows[0]);
      io.emit("rowUpdated", mappedRow);
      return res.json(mappedRow);
    }

    // Handle regular edits
    const updated = await pool.query(
      `UPDATE requisitions SET client=$1, title=$2, status=$3, slots=$4 WHERE requirement_id=$5 RETURNING *`,
      [
        client || row.client,
        title || row.title,
        status || row.status,
        slots !== undefined ? slots : row.slots,
        requirementId,
      ]
    );
    const mappedUpdated = mapRow(updated.rows[0]);
    io.emit("rowUpdated", mappedUpdated);
    res.json(mappedUpdated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB Update Failed" });
  }
});

// Serve React frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// Start server with Socket.IO
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Backend + Frontend running on port ${PORT}`));
