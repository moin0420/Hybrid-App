import express from "express";
import { Pool } from "pg";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DB_URL
});

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize table if not exists
const initTable = async () => {
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
};
initTable().catch(console.error);

// Map row to frontend format
const mapRow = (row) => ({
  client: row.client,
  requirementId: row.requirementid,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assignedrecruiter || "",
  working: row.working,
});

// ===== API Routes =====

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

// ===== Serve React frontend =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`✅ Backend + Frontend running on port ${PORT}`)
);
