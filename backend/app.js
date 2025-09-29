import express from "express";
import { Pool } from "pg";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Postgres Pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// API: Get all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM requisitions ORDER BY id");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// API: Update a requisition
app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { client_name, requirement_id, job_title, status, slots, assigned_recruiter, working } = req.body;

    await pool.query(
      `UPDATE requisitions
       SET client_name=$1, requirement_id=$2, job_title=$3, status=$4, slots=$5, assigned_recruiter=$6, working=$7
       WHERE id=$8`,
      [client_name, requirement_id, job_title, status, slots, assigned_recruiter, working, id]
    );

    const { rows } = await pool.query("SELECT * FROM requisitions WHERE id=$1", [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database update error" });
  }
});

// API: Add a new row
app.post("/api/requisitions", async (req, res) => {
  try {
    const { client_name, requirement_id, job_title, status, slots } = req.body;

    const { rows } = await pool.query(
      `INSERT INTO requisitions (client_name, requirement_id, job_title, status, slots)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [client_name || '', requirement_id || '', job_title || '', status || 'Open', slots || 1]
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert error" });
  }
});

// Serve React frontend
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
