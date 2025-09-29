// backend/app.js
import express from "express";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import fs from "fs";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Postgres connection
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false }
});

// Verify DB connection at startup
try {
  const client = await pool.connect();
  console.log("✅ Connected to Postgres database");
  client.release();
} catch (err) {
  console.error("❌ Failed to connect to database:", err);
  process.exit(1);
}

// API routes

// GET all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching requisitions:", err);
    res.status(500).json({ error: "Failed to fetch requisitions" });
  }
});

// UPDATE requisition
app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, working, assigned_recruiter } = req.body;

    await pool.query(
      `UPDATE requisitions 
       SET name = $1, working = $2, assigned_recruiter = $3 
       WHERE id = $4`,
      [name, working, assigned_recruiter, id]
    );

    const updated = await pool.query("SELECT * FROM requisitions WHERE id = $1", [id]);
    res.json(updated.rows[0]);
  } catch (err) {
    console.error("Error updating requisition:", err);
    res.status(500).json({ error: "Failed to update requisition" });
  }
});

// Serve React frontend if build exists
const buildDir = path.join(__dirname, "../frontend/build");
if (fs.existsSync(buildDir)) {
  app.use(express.static(buildDir));
  app.get("/*", (req, res) => {
    res.sendFile(path.join(buildDir, "index.html"));
  });
} else {
  console.warn("⚠️ frontend build not found, serving API only.");
  app.get("/", (req, res) => res.send("Backend API running"));
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});