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
const { Pool, Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
  // optional: you can tune pool size here
  // max: 10,
});

// Log pool errors on idle clients so they don't crash the process
pool.on("error", (err, client) => {
  console.error("❌ Unexpected error on idle PostgreSQL client:", err);
});

// ====== REAL-TIME DB LISTENER (Dedicated Client, robust reconnect) ======
let listenerClient = null;
let listenerReconnectDelay = 2000; // initial backoff

const startListener = async () => {
  // If an old client exists, try to end it first
  if (listenerClient) {
    try {
      await listenerClient.end();
    } catch (e) {
      // ignore
    }
    listenerClient = null;
  }

  listenerClient = new Client({
    connectionString: process.env.DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  // Prevent uncaught exceptions from crashing Node
  listenerClient.on("error", (err) => {
    console.error("❌ Listener client error:", err);
    // we'll reconnect when 'end' happens or via the catch below
  });

  listenerClient.on("end", () => {
    console.warn("⚠️ Listener client connection ended. Reconnecting in", listenerReconnectDelay, "ms");
    setTimeout(() => startListener().catch(console.error), listenerReconnectDelay);
    // exponential backoff with cap
    listenerReconnectDelay = Math.min(30000, Math.floor(listenerReconnectDelay * 1.5));
  });

  try {
    await listenerClient.connect();
    console.log("👂 Dedicated listener connected for 'requisitions_change'");

    // reset backoff on successful connect
    listenerReconnectDelay = 2000;

    listenerClient.on("notification", (msg) => {
      try {
        if (!msg || !msg.payload) return;
        const payload = JSON.parse(msg.payload);
        console.log("📡 DB change detected:", payload);

        if (payload.operation === "INSERT") io.emit("requisition_created", payload.new);
        if (payload.operation === "UPDATE") io.emit("requisitions_updated", payload.new);
        if (payload.operation === "DELETE") io.emit("requisition_deleted", payload.old?.requirementid);
      } catch (e) {
        console.error("❌ Error parsing notification payload:", e);
      }
    });

    await listenerClient.query("LISTEN requisitions_change");
  } catch (err) {
    console.error("❌ Failed to start listener, will retry:", err);
    try {
      await listenerClient.end();
    } catch (e) {
      // ignore
    }
    listenerClient = null;
    setTimeout(() => startListener().catch(console.error), listenerReconnectDelay);
  }
};

// Start the dedicated listener
startListener().catch((e) => console.error("Listener startup error:", e));

// ===== SOCKET.IO HANDLING =====
const activeEditors = new Map(); // { requirementid: { user, field, socket } }

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  // User starts/stops editing
  socket.on("editing_status", (data) => {
    const { requirementid, field, user, isEditing } = data;
    if (isEditing) {
      activeEditors.set(requirementid, { user, field, socket: socket.id });
    } else {
      activeEditors.delete(requirementid);
    }

    // Notify everyone else
    socket.broadcast.emit("editing_status", data);
  });

  // Broadcast live requisition updates
  socket.on("requisitions_updated", (updatedRow) => {
    console.log("📡 Broadcasting update:", updatedRow?.requirementid);
    io.emit("requisitions_updated", updatedRow);
  });

  // Broadcast new requisition creation
  socket.on("requisition_created", (newRow) => {
    console.log("📡 Broadcasting new requisition:", newRow?.requirementid);
    io.emit("requisition_created", newRow);
  });

  // Broadcast requisition deletion
  socket.on("requisition_deleted", (reqId) => {
    console.log("📡 Broadcasting deletion:", reqId);
    io.emit("requisition_deleted", reqId);
  });

  // Cleanup on disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (const [reqId, editor] of activeEditors.entries()) {
      if (editor.socket === socket.id) {
        activeEditors.delete(reqId);
        socket.broadcast.emit("editing_status", {
          requirementid: reqId,
          field: editor.field,
          user: null,
          isEditing: false,
        });
      }
    }
  });
});

// ===== ROUTES =====

// Fetch all requisitions
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY requirementid ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching requisitions:", err);
    res.status(500).send("Error fetching data");
  }
});

// Create new requisition
app.post("/api/requisitions", async (req, res) => {
  try {
    let { requirementid, requirementId, title, client, slots, status } = req.body;
    requirementid = (requirementid || requirementId || "").replace(/\s+/g, ""); // remove all spaces

    if (!requirementid || requirementid.trim() === "") {
      return res.status(400).json({ message: "Requirement ID is mandatory to create a new row." });
    }

    // Ensure unique ID
    const exists = await pool.query("SELECT requirementid FROM requisitions WHERE requirementid = $1", [requirementid]);
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "Requirement ID already exists." });
    }

    const result = await pool.query(
      `
      INSERT INTO requisitions
        (requirementid, title, client, slots, status, assigned_recruiters, working_times)
      VALUES ($1, $2, $3, $4, $5, '{}', '{}')
      RETURNING *;
      `,
      [requirementid, title || "", client || "", slots || 1, status || "Open"]
    );

    const newRow = result.rows[0];
    io.emit("requisition_created", newRow); // real-time broadcast
    res.json(newRow);
  } catch (err) {
    console.error("❌ Error adding requisition:", err);
    res.status(500).send("Error adding requisition");
  }
});

// Update requisition
app.put("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  try {
    const { rows } = await pool.query("SELECT assigned_recruiters, slots, status FROM requisitions WHERE requirementid=$1", [id]);
    if (!rows.length) return res.status(404).send("Requisition not found");

    const assigned = rows[0].assigned_recruiters || [];
    if (assigned.length > 0 && ("status" in fields || "slots" in fields)) {
      return res.status(400).json({
        message: "A Recruiter is working on this req. Please ask them to stop working and try again.",
      });
    }

    const keys = Object.keys(fields);
    if (!keys.length) return res.json({ message: "No changes" });

    const setClauses = keys.map((key, i) => `${key.toLowerCase()}=$${i + 1}`);
    const values = Object.values(fields);

    const result = await pool.query(
      `
      UPDATE requisitions
      SET ${setClauses.join(", ")}, createdat = NOW()
      WHERE requirementid=$${keys.length + 1}
      RETURNING *;
      `,
      [...values, id]
    );

    const updatedRow = result.rows[0];
    io.emit("requisitions_updated", updatedRow);
    res.json(updatedRow);
  } catch (err) {
    console.error("❌ Error updating requisition:", err);
    res.status(500).send("Error updating requisition");
  }
});

// Delete requisition
app.delete("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM requisitions WHERE requirementid=$1 RETURNING requirementid", [id]);
    if (!result.rowCount) {
      return res.status(404).json({ message: "Requisition not found" });
    }
    io.emit("requisition_deleted", id);
    res.json({ message: "Requisition deleted", id });
  } catch (err) {
    console.error("❌ Error deleting requisition:", err);
    res.status(500).send("Error deleting requisition");
  }
});

// ====== DB INITIALIZATION HELPERS ======
const connectWithRetry = async (retries = 5, delay = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT NOW()");
      console.log("✅ Connected to PostgreSQL");
      return;
    } catch (err) {
      console.error(`❌ DB connection failed (attempt ${attempt}/${retries})`, err.message || err);
      if (attempt === retries) throw err;
      await new Promise((res) => setTimeout(res, delay));
    }
  }
};

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

// ===== Graceful shutdown ======
const shutdown = async () => {
  console.log("Shutting down server...");
  try {
    if (listenerClient) await listenerClient.end();
  } catch (e) {
    // ignore
  }
  try {
    await pool.end();
  } catch (e) {
    // ignore
  }
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Export app for testing (optional)
export default app;
