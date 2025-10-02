// backend/app.js
import express from "express";
import { Pool } from "pg";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

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
// API Routes
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

// PUT toggle working
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { working, userName } = req.body;

  if (typeof working !== "boolean" || typeof userName !== "string") {
    return res.status(400).json({ message: "Invalid payload" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM requisitions WHERE requirementId = $1",
      [requirementId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    const currentAssigned = row.assignedrecruiter || "";

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
      return res.status(200).json({ message: "Assigned successfully" });
    } else {
      if (!currentAssigned || currentAssigned === "") {
        return res.status(200).json({ message: "Already unassigned" });
      }
      if (currentAssigned !== userName) {
        return res
          .status(409)
          .json({ message: `Cannot unassign; assigned to ${currentAssigned}` });
      }
      await pool.query(
        "UPDATE requisitions SET working = FALSE, assignedRecruiter = '' WHERE requirementId = $1",
        [requirementId]
      );
      return res.status(200).json({ message: "Unassigned successfully" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// -----------------------------
// PUT update requisition (general fields)
// -----------------------------
app.put("/api/requisitions/update/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { client, title, status, slots } = req.body;

  try {
    const result = await pool.query(
      "UPDATE requisitions SET client=$1, title=$2, status=$3, slots=$4 WHERE requirementId=$5 RETURNING *",
      [client, title, status, slots, requirementId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ message: "Requirement not found" });

    res.json({ message: "Updated successfully", updatedRow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB update failed" });
  }
});

// -----------------------------
// POST add new requisition
// -----------------------------
app.post("/api/requisitions", async (req, res) => {
  const { requirementId, client, title, status, slots } = req.body;

  if (!requirementId || !client || !title || !status) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO requisitions
      (requirementId, client, title, status, slots)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *`,
      [requirementId, client, title, status, slots || 0]
    );

    res.status(201).json({ message: "Added successfully", newRow: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// Optional seed endpoint
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
    res.json({ message: "Seeded" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Seed failed" });
  }
});

// -----------------------------
// Serve React frontend
// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));

// Catch-all for React Router
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend + Frontend running on port ${PORT}`));
