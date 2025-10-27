import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import pkg from "pg";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const { Pool } = pkg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(bodyParser.json());

// PostgreSQL connection using Render DB_URL
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Retry connection until DB is ready
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT NOW()");
      console.log("✅ Connected to PostgreSQL");
      return;
    } catch (err) {
      console.error(
        `❌ Database connection failed (attempt ${attempt}/${retries})`
      );
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

// Ensure table exists
const ensureTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS requisitions (
      requirementid TEXT PRIMARY KEY,
      title TEXT,
      client TEXT,
      assigned_recruiters TEXT[],
      working_times JSONB,
      slots INTEGER,
      status TEXT,
      createdat TIMESTAMP DEFAULT NOW()
    );
  `;
  await pool.query(query);
  console.log("✅ Table checked/created");
};

// ===== SOCKET.IO HANDLING =====
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("editing_status", (data) => {
    socket.broadcast.emit("editing_status", data);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });
});

// ===== ROUTES =====
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM requisitions ORDER BY requirementid ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching requisitions:", err);
    res.status(500).send("Error fetching data");
  }
});

app.post("/api/requisitions", async (req, res) => {
  try {
    const { title, client, slots, status } = req.body;
    const newReqId = `REQ-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO requisitions (requirementid, title, client, slots, status, assigned_recruiters, working_times)
       VALUES ($1, $2, $3, $4, $5, '{}', '{}') RETURNING *`,
      [newReqId, title || "", client || "", slots || 1, status || "Open"]
    );

    io.emit("requisitions_updated");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error adding row:", err);
    res.status(500).send("Error adding requisition");
  }
});

app.put("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  try {
    const { rows } = await pool.query(
      "SELECT assigned_recruiters, slots, status FROM requisitions WHERE requirementid=$1",
      [id]
    );
    if (!rows.length) return res.status(404).send("Requisition not found");

    const assigned = rows[0].assigned_recruiters || [];

    if (assigned.length > 0 && ("status" in fields || "slots" in fields)) {
      return res.status(400).json({
        message:
          "A Recruiter is working on this req. Please ask them to stop working and try changing again",
      });
    }

    const keys = Object.keys(fields);
    if (!keys.length) return res.json({ message: "No changes" });

    const setClauses = keys.map((key, i) => `${key.toLowerCase()}=$${i + 1}`);
    const values = Object.values(fields);

    const updateQuery = `
      UPDATE requisitions
      SET ${setClauses.join(", ")}
      WHERE requirementid=$${keys.length + 1}
      RETURNING *;
    `;
    const result = await pool.query(updateQuery, [...values, id]);

    io.emit("requisitions_updated");
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error updating requisition:", err);
    res.status(500).send("Error updating requisition");
  }
});

// ===== SERVE FRONTEND =====
app.use(express.static(path.join(__dirname, "frontend")));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;
server.listen(PORT, async () => {
  try {
    await connectWithRetry();
    await ensureTable();
    console.log(`🚀 Server running on port ${PORT}`);
  } catch (err) {
    console.error("❌ Could not connect to database:", err);
    process.exit(1);
  }
});
