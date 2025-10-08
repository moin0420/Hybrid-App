// backend/app.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import pkg from "pg";
const { Pool } = pkg;
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize table safely
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
await initTable();

const mapRow = (row) => ({
  id: row.id,
  requirementId: row.requirement_id,
  client: row.client,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assigned_recruiter || "",
  working: row.working,
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Debounced broadcast map
const broadcastTimers = new Map();
const broadcastDebounced = async (key = "all") => {
  if (broadcastTimers.has(key)) clearTimeout(broadcastTimers.get(key));
  broadcastTimers.set(
    key,
    setTimeout(async () => {
      const all = await pool.query("SELECT * FROM requisitions ORDER BY id DESC");
      io.emit("requisitions_updated", all.rows.map(mapRow));
      broadcastTimers.delete(key);
    }, 1200) // wait 1.2s after last edit before pushing to everyone
  );
};

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
  try {
    const result = await pool.query(
      `INSERT INTO requisitions (requirement_id, client, title, status, slots)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (requirement_id) DO NOTHING
       RETURNING *`,
      [requirementId, client || "", title || "", status || "Open", slots || 0]
    );
    await broadcastDebounced(); // broadcast after small delay
    if (result.rows[0]) return res.status(201).json(mapRow(result.rows[0]));
    return res.status(409).json({ message: "RequirementId conflict or not inserted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// PUT update row
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  try {
    const select = await pool.query("SELECT * FROM requisitions WHERE requirement_id = $1", [requirementId]);
    const row = select.rows[0];

    // Case: requirementId being changed (rename)
    if (!row && req.body.newRequirementId) {
      const updateNewId = await pool.query(
        "UPDATE requisitions SET requirement_id=$1 WHERE requirement_id=$2 RETURNING *",
        [req.body.newRequirementId, requirementId]
      );
      await broadcastDebounced();
      return res.json(mapRow(updateNewId.rows[0]));
    }

    if (!row) return res.status(404).json({ message: "Requirement not found" });

    // Working toggle
    if (Object.prototype.hasOwnProperty.call(req.body, "working")) {
      const { working, userName } = req.body;
      if (typeof working !== "boolean" || typeof userName !== "string") {
        return res.status(400).json({ message: "Invalid payload for working toggle" });
      }

      const currentAssigned = row.assigned_recruiter || "";
      if (working) {
        if (currentAssigned && currentAssigned !== "") {
          return res.status(409).json({ message: `Already assigned to ${currentAssigned}` });
        }
        await pool.query(
          "UPDATE requisitions SET working = TRUE, assigned_recruiter = $1 WHERE requirement_id = $2",
          [userName, requirementId]
        );
      } else {
        if (!currentAssigned || currentAssigned === "") {
          return res.status(200).json({ message: "Already unassigned" });
        }
        if (currentAssigned !== userName) {
          return res.status(409).json({ message: `Cannot unassign; assigned to ${currentAssigned}` });
        }
        await pool.query(
          "UPDATE requisitions SET working = FALSE, assigned_recruiter = '' WHERE requirement_id = $1",
          [requirementId]
        );
      }
      await broadcastDebounced();
      return res.json({ message: "Working status updated" });
    }

    // Normal edits (client, title, status, slots, requirement_id)
    const updates = {
      requirement_id: req.body.requirementId || row.requirement_id,
      client: req.body.client !== undefined ? req.body.client : row.client,
      title: req.body.title !== undefined ? req.body.title : row.title,
      status: req.body.status !== undefined ? req.body.status : row.status,
      slots: req.body.slots !== undefined ? req.body.slots : row.slots,
    };

    const updated = await pool.query(
      `UPDATE requisitions
       SET requirement_id=$1, client=$2, title=$3, status=$4, slots=$5
       WHERE id=$6 RETURNING *`,
      [updates.requirement_id, updates.client, updates.title, updates.status, updates.slots, row.id]
    );

    // Debounced broadcast prevents instant refocus loss
    await broadcastDebounced();
    return res.json(mapRow(updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB Update Failed" });
  }
});

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
  }
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("🟢 Socket connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 Socket disconnected:", socket.id));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Backend + Frontend running on port ${PORT}`));
