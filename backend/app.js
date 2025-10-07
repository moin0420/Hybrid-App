import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Create Socket.IO instance
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT"],
  },
});

app.use(cors());
app.use(express.json());

// PostgreSQL connection
const { Pool } = pkg;
const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false },
});

// --------------------- API ROUTES --------------------- //
app.get("/api/requisitions", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM requisitions ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ DB fetch error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

app.put("/api/requisitions/:id", async (req, res) => {
  const { id } = req.params;
  const { column, value } = req.body;

  try {
    await pool.query(`UPDATE requisitions SET ${column} = $1 WHERE id = $2`, [value, id]);

    // Notify all clients of change
    io.emit("requisitionUpdated", { id, column, value });
    res.json({ message: "Updated successfully" });
  } catch (err) {
    console.error("❌ DB update error:", err);
    res.status(500).json({ message: "DB update failed" });
  }
});

// --------------------- SOCKET HANDLERS --------------------- //
io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("startEditing", (data) => {
    socket.broadcast.emit("editingCell", data);
  });

  socket.on("stopEditing", () => {
    socket.broadcast.emit("editingStopped");
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);
  });
});

// --------------------- FRONTEND SERVE --------------------- //
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "../frontend/build")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
});

// --------------------- START SERVER --------------------- //
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
