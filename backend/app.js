// backend/app.js
import express from "express";
import { Pool } from "pg";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// -----------------------------
// PostgreSQL Pool with SSL
// -----------------------------
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false, // required for Render, Railway, etc.
  },
});

// -----------------------------
// Initialize table safely
// -----------------------------
const initTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS requisitions (
        id SERIAL PRIMARY KEY,
        requirementId TEXT UNIQUE,
        client TEXT,
        title TEXT,
        status TEXT,
        slots INTEGER DEFAULT 0,
        assignedRecruiter TEXT DEFAULT '',
        working BOOLEAN DEFAULT FALSE
      );
    `);
    console.log("✅ Table initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize table:", err);
  }
};

initTable();

// -----------------------------
// Map row to frontend format
// -----------------------------
const mapRow = (row) => ({
  client: row.client,
  requirementId: row.requirementid,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assignedrecruiter || "",
  working: row.working,
});

// -----------------------------
// Routes
// -----------------------------

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

// PUT toggle working or update row fields
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { working, userName, client, title, status, slots } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM requisitions WHERE requirementId = $1",
      [requirementId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    // Update row fields if provided
    await pool.query(
      `UPDATE requisitions
       SET client = COALESCE($1, client),
           title = COALESCE($2, title),
           status = COALESCE($3, status),
           slots = COALESCE($4, slots)
       WHERE requirementId = $5`,
      [client, title, status, slots, requirementId]
    );

    // Handle working toggle logic (same as before)
    const currentAssigned = row.assignedrecruiter || "";

    if (typeof working === "boolean") {
      if (working) {
        if (currentAssigned && currentAssigned !== "") {
          return res
            .status(409)
            .json({ message: `Already assigned to ${currentAssigned}` });
        }
        await pool.query(
          "UPDATE requisitions SET working = TRUE, assignedRecruiter = $1 WHERE requirementId = $2",
          [userName, requirementId]
        );
      } else {
        if (currentAssigned && currentAssigned !== userName) {
          return res
            .status(409)
            .json({ message: `Cannot unassign; assigned to ${currentAssigned}` });
        }
        await pool.query(
          "UPDATE requisitions SET working = FALSE, assignedRecruiter = '' WHERE requirementId = $1",
          [requirementId]
        );
      }
    }

    const updated = await pool.query(
      "SELECT * FROM requisitions WHERE requirementId = $1",
      [requirementId]
    );

    const mapped = mapRow(updated.rows[0]);

    // 🔥 Broadcast row update via socket.io
    io.emit("rowUpdated", mapped);

    res.status(200).json(mapped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// POST seed endpoint
app.post("/api/requisitions/seed", async (req, res) => {
  const items = req.body.items || [];
  try {
    for (const it of items) {
      await pool.query(
        `INSERT INTO requisitions
        (requirementId, client, title, status, slots, assignedRecruiter, working)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (requirementId) DO NOTHING`,
        [
          it.requirementId,
          it.client,
          it.title,
          it.status,
          it.slots || 0,
          it.assignedRecruiter || "",
          it.working || false,
        ]
      );
    }

    // 🔥 Notify clients of new rows
    io.emit("rowsSeeded");

    res.json({ message: "Seeded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Seed failed" });
  }
});

// -----------------------------
// Start server + Socket.IO
// -----------------------------
const PORT = process.env.PORT || 5000;
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});

io.on("connection", (socket) => {
  console.log("🔌 New client connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

server.listen(PORT, () =>
  console.log(`✅ Backend + Socket.IO running on port ${PORT}`)
);
