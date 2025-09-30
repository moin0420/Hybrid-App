import express from "express";
import bodyParser from "body-parser";
import pkg from "pg";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const { Pool } = pkg;

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Fetch all rows
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch error:", err);
    res.status(500).json({ error: "Failed to fetch rows" });
  }
});

// Add new row
app.post("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query(
      `INSERT INTO requisitions (client_name, requirement_id, job_title, status, slots, assigned_recruiter, working, locked_by)
       VALUES ('', '', '', 'Open', 0, '', false, NULL)
       RETURNING *`
    );
    const newRow = result.rows[0];
    io.emit("row-added", newRow);
    res.json(newRow);
  } catch (err) {
    console.error("Add row error:", err);
    res.status(500).json({ error: "Failed to add row" });
  }
});

// Update a row
app.put("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  const {
    client_name,
    requirement_id,
    job_title,
    status,
    slots,
    assigned_recruiter,
    working,
    current_user,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE requisitions
       SET client_name = $1,
           requirement_id = $2,
           job_title = $3,
           status = $4,
           slots = $5,
           assigned_recruiter = $6,
           working = $7,
           locked_by = $8
       WHERE id = $9
       RETURNING *`,
      [
        client_name || "",
        requirement_id || "",
        job_title || "",
        status || "Open",
        slots || 0,
        assigned_recruiter || "",
        working || false,
        working ? current_user : null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Row not found" });
    }

    const updatedRow = result.rows[0];

    io.emit("row-updated", updatedRow); // 🔹 broadcast change
    res.json(updatedRow);
  } catch (err) {
    console.error("Update error:", err);
    res.status(500).json({ error: "Failed to update row" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
