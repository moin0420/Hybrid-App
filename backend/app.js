import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

const PORT = process.env.PORT || 5000;

// --- REST API ---
app.get("/api/requirements", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requirements ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("DB Fetch Error:", err);
    res.status(500).json({ error: "Database fetch failed" });
  }
});

app.put("/api/requirements/:id", async (req, res) => {
  const { id } = req.params;
  const { field, value } = req.body;
  try {
    const result = await pool.query(
      `UPDATE requirements SET ${field} = $1 WHERE id = $2 RETURNING *`,
      [value, id]
    );
    if (result.rows.length > 0) {
      const updated = result.rows[0];
      io.emit("rowUpdated", updated);
      res.json(updated);
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err) {
    console.error("DB Update Error:", err);
    res.status(500).json({ error: "Database update failed" });
  }
});

// --- SOCKET.IO REALTIME LOGIC ---
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("editField", async (data) => {
    const { id, field, value, user } = data;
    try {
      await pool.query(`UPDATE requirements SET ${field} = $1 WHERE id = $2`, [value, id]);
      io.emit("fieldUpdated", data);
    } catch (err) {
      console.error("Edit Error:", err);
    }
  });

  socket.on("toggleWorking", async (data) => {
    const { id, recruiter, working } = data;
    try {
      const result = await pool.query(
        "UPDATE requirements SET assigned_recruiter = $1, working = $2 WHERE id = $3 RETURNING *",
        [recruiter, working, id]
      );
      io.emit("rowUpdated", result.rows[0]);
    } catch (err) {
      console.error("Toggle Error:", err);
    }
  });

  socket.on("editingStart", (data) => {
    io.emit("editingStart", data); // broadcast to all
  });

  socket.on("editingStop", (data) => {
    io.emit("editingStop", data); // broadcast to all
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
