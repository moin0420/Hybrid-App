import express from "express";
import pkg from "pg";
const { Pool } = pkg;
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize table
const initTable = async () => {
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
    )
  `);
};
initTable();

// Map row for frontend
const mapRow = row => ({
  requirementId: row.requirement_id,
  client: row.client,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assigned_recruiter,
  working: row.working,
});

// Get all rows
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id DESC");
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB read error" });
  }
});

// Add new row
app.post("/api/requisitions", async (req, res) => {
  const { requirementId, client, title, status, slots } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO requisitions
       (requirement_id, client, title, status, slots)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [requirementId, client, title, status || "Open", slots || 0]
    );
    res.status(201).json(mapRow(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB insert failed" });
  }
});

// Update row
app.put("/api/requisitions/:requirementId", async (req, res) => {
  const { requirementId } = req.params;
  const { client, title, status, slots, working, userName } = req.body;

  try {
    const result = await pool.query(
      "SELECT * FROM requisitions WHERE requirement_id=$1",
      [requirementId]
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ message: "Requirement not found" });

    // Handle working
    if (typeof working === "boolean" && userName) {
      const assigned = row.assigned_recruiter || "";
      if (working) {
        if (assigned && assigned !== "") return res.status(409).json({ message: `Already assigned to ${assigned}` });
        await pool.query(
          "UPDATE requisitions SET working=TRUE, assigned_recruiter=$1 WHERE requirement_id=$2",
          [userName, requirementId]
        );
      } else {
        if (assigned !== userName) return res.status(409).json({ message: `Cannot unassign; assigned to ${assigned}` });
        await pool.query(
          "UPDATE requisitions SET working=FALSE, assigned_recruiter='' WHERE requirement_id=$1",
          [requirementId]
        );
      }
      const updatedRow = await pool.query("SELECT * FROM requisitions WHERE requirement_id=$1", [requirementId]);
      return res.json(mapRow(updatedRow.rows[0]));
    }

    // Regular edits
    const updated = await pool.query(
      `UPDATE requisitions SET client=$1, title=$2, status=$3, slots=$4 WHERE requirement_id=$5 RETURNING *`,
      [
        client ?? row.client,
        title ?? row.title,
        status ?? row.status,
        slots ?? row.slots,
        requirementId,
      ]
    );
    res.json(mapRow(updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB Update Failed" });
  }
});

// Serve frontend
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
