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
        requirementId TEXT UNIQUE,
        client TEXT,
        title TEXT,
        status TEXT,
        slots INTEGER DEFAULT 0,
        assignedRecruiter TEXT DEFAULT '',
        working BOOLEAN DEFAULT FALSE
      );
    `);
    console.log("✅ Table initialized");
  } catch (err) {
    console.error("❌ Table init failed", err);
  }
};
initTable();

// Map row
const mapRow = (row) => ({
  id: row.id,
  client: row.client,
  requirementId: row.requirementid,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assignedrecruiter || "",
  working: row.working,
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

// PUT toggle working
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { working, userName } = req.body;

  if (typeof working !== "boolean" || typeof userName !== "string") {
    return res.status(400).json({ message: "Invalid payload" });
  }

  if (!requirementId) return res.status(400).json({ message: "Requirement ID missing" });

  try {
    const rowRes = await pool.query("SELECT * FROM requisitions WHERE requirementId=$1", [requirementId]);
    const row = rowRes.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    const currentAssigned = row.assignedrecruiter || "";

    if (working) {
      if (currentAssigned && currentAssigned !== userName)
        return res.status(409).json({ message: `Already assigned to ${currentAssigned}` });

      await pool.query(
        "UPDATE requisitions SET working=TRUE, assignedRecruiter=$1 WHERE requirementId=$2",
        [userName, requirementId]
      );
    } else {
      if (currentAssigned !== userName)
        return res.status(409).json({ message: `Cannot unassign; assigned to ${currentAssigned}` });

      await pool.query(
        "UPDATE requisitions SET working=FALSE, assignedRecruiter='' WHERE requirementId=$1",
        [requirementId]
      );
    }

    const updatedRowRes = await pool.query("SELECT * FROM requisitions WHERE requirementId=$1", [requirementId]);
    res.json({ message: "Updated successfully", updatedRow: updatedRowRes.rows[0] });
  } catch (err) {
    console.error("Working toggle error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// PUT update any row fields
app.put("/api/requisitions/update/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { client, title, status, slots, requirementId: newReqId } = req.body;

  if (!requirementId) return res.status(400).json({ message: "Requirement ID missing" });

  try {
    const result = await pool.query(
      `UPDATE requisitions
       SET client=$1, title=$2, status=$3, slots=$4, requirementId=$5
       WHERE id = (SELECT id FROM requisitions WHERE requirementId=$6)
       RETURNING *`,
      [client, title, status, slots, newReqId, requirementId]
    );

    if (result.rowCount === 0) return res.status(404).json({ message: "Row not found" });

    res.json({ message: "Updated successfully", updatedRow: result.rows[0] });
  } catch (err) {
    console.error("Row update error:", err);
    res.status(500).json({ message: "DB update failed" });
  }
});

// POST add blank row
app.post("/api/requisitions/new", async (req, res) => {
  try {
    const tempId = `temp_${Date.now()}`;
    const result = await pool.query(
      `INSERT INTO requisitions (requirementId, client, title, status, slots)
       VALUES ($1, '', '', 'Open', 0)
       RETURNING *`,
      [tempId]
    );
    res.status(201).json({ newRow: result.rows[0] });
  } catch (err) {
    console.error("Add row error:", err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
