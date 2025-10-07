import express from "express";
import { Server } from "socket.io";
import http from "http";
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

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// Initialize table
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

// Map row for frontend
const mapRow = (row) => ({
  client: row.client,
  requirementId: row.requirement_id,
  title: row.title,
  status: row.status,
  slots: row.slots,
  assignedRecruiter: row.assigned_recruiter || "",
  working: row.working,
});

// HTTP server
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// -----------------
// Socket.io events
// -----------------
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  socket.on("editRow", async (row) => {
    try {
      const { requirementId, client, title, status, slots, working, userName } = row;
      const dbRow = await pool.query("SELECT * FROM requisitions WHERE requirement_id=$1", [requirementId]);
      if (!dbRow.rows[0]) return;

      // Handle working checkbox logic
      if (typeof working === "boolean" && userName) {
        const currentAssigned = dbRow.rows[0].assigned_recruiter || "";
        if (working) {
          if (currentAssigned && currentAssigned !== "") {
            socket.emit("errorMsg", `Already assigned to ${currentAssigned}`);
            return;
          }
          await pool.query(
            "UPDATE requisitions SET working=TRUE, assigned_recruiter=$1 WHERE requirement_id=$2",
            [userName, requirementId]
          );
        } else {
          if (currentAssigned !== userName) {
            socket.emit("errorMsg", `Cannot unassign; assigned to ${currentAssigned}`);
            return;
          }
          await pool.query(
            "UPDATE requisitions SET working=FALSE, assigned_recruiter='' WHERE requirement_id=$1",
            [requirementId]
          );
        }
      } else {
        await pool.query(
          `UPDATE requisitions SET client=$1, title=$2, status=$3, slots=$4 WHERE requirement_id=$5`,
          [client, title, status, slots, requirementId]
        );
      }

      // Broadcast updated table to all clients
      const allRows = await pool.query("SELECT * FROM requisitions ORDER BY id DESC");
      io.emit("updateRows", allRows.rows.map(mapRow));
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("addRow", async () => {
    try {
      const newRequirementId = "REQ_" + Date.now();
      await pool.query(
        `INSERT INTO requisitions (requirement_id, client, title, status, slots) VALUES ($1,'','','Open',1)`,
        [newRequirementId]
      );
      const allRows = await pool.query("SELECT * FROM requisitions ORDER BY id DESC");
      io.emit("updateRows", allRows.rows.map(mapRow));
    } catch (err) {
      console.error(err);
    }
  });
});

// Serve frontend
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "../frontend/build")));
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api")) {
    res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
  }
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`✅ Backend + Frontend + Socket.io running on port ${PORT}`));
