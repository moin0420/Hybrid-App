// backend/app.js
import express from "express";
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

// -----------------------------
// PostgreSQL Pool with SSL
// -----------------------------
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: {
    rejectUnauthorized: false,
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

// -----------------------------
// Map row to frontend format
// -----------------------------
const mapRow = (row) => ({
  client: row.client,
  requirementId: row.requirement_id,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assigned_recruiter || "",
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

// POST add new row (blank by default)
app.post("/api/requisitions", async (req, res) => {
  try {
    const defaultRequirementId = `REQ-${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO requisitions (requirement_id, client, title, status, slots)
       VALUES ($1, '', '', '', 0) RETURNING *`,
      [defaultRequirementId]
    );
    res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// PUT update row or toggle working
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { client, title, status, slots, working, userName } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM requisitions WHERE requirement_id = $1",
      [requirementId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    // Handle working toggle
    if (typeof working === "boolean" && typeof userName === "string") {
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
      const updatedRow = await pool.query(
        "SELECT * FROM requisitions WHERE requirement_id = $1",
        [requirementId]
      );
      return res.json(mapRow(updatedRow.rows[0]));
    }

    // Handle regular edits
    const updated = await pool.query(
      `UPDATE requisitions SET client=$1, title=$2, status=$3, slots=$4
       WHERE requirement_id=$5 RETURNING *`,
      [
        client !== undefined ? client : row.client,
        title !== undefined ? title : row.title,
        status !== undefined ? status : row.status,
        slots !== undefined ? slots : row.slots,
        requirementId,
      ]
    );
    res.json(mapRow(updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB Update Failed" });
  }
});

// -----------------------------
// Serve React frontend
// -----------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
  }
});

// -----------------------------
// Start server
// -----------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend + Frontend running on port ${PORT}`));
