import express from "express";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;
const app = express();

app.use(cors());
app.use(express.json());

// PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Normalize row keys
const mapRow = (row) => ({
  client: row.client,
  requirementId: row.requirementid,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assignedrecruiter || "",
  working: row.working,
});

// Routes
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions");
    res.json(result.rows.map(mapRow));
  } catch (err) {
    console.error("❌ Error fetching data:", err);
    res.status(500).json({ error: "Failed to fetch requisitions" });
  }
});

app.post("/api/requisitions", async (req, res) => {
  const { client, requirementId, title, status, slots, assignedRecruiter, working } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO requisitions 
       (client, requirementId, title, status, slots, assignedRecruiter, working)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client, requirementId, title, status, slots, assignedRecruiter, working]
    );
    res.json(mapRow(result.rows[0]));
  } catch (err) {
    console.error("❌ Error inserting:", err);
    res.status(500).json({ error: "Failed to add requisition" });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Backend running on port ${PORT}`));
