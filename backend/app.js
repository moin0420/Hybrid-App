import express from "express";
import { Pool } from "pg";
import path from "path";
import cors from "cors";
import bodyParser from "body-parser";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend/build")));

const pool = new Pool({ connectionString: process.env.DB_URL, ssl: { rejectUnauthorized: false } });

io.on("connection", (socket) => console.log("User connected:", socket.id));

app.get("/api/requisitions", async (req, res) => {
  try { const { rows } = await pool.query("SELECT * FROM requisitions ORDER BY id"); res.json(rows); }
  catch (err) { console.error(err); res.status(500).json({ error: "Database error" }); }
});

app.put("/api/requisitions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { client_name, requirement_id, job_title, status, slots, working, current_user } = req.body;
    const { rows: existingRows } = await pool.query("SELECT * FROM requisitions WHERE id=$1", [id]);
    if (!existingRows[0]) return res.status(404).json({ error: "Row not found" });
    const row = existingRows[0];

    if (row.locked_by && row.locked_by !== current_user) return res.status(403).json({ error: "Row locked by another user" });
    if (working) {
      if (row.status !== "Open" || row.slots <= 0) return res.status(400).json({ error: "Row is non-workable" });
      const { rows: otherWorking } = await pool.query("SELECT * FROM requisitions WHERE working=true AND id<>$1", [id]);
      if (otherWorking.length > 0) return res.status(400).json({ error: "Another user is already working on a row" });
    }

    const assigned_recruiter = working ? current_user : "";
    const locked_by = working ? current_user : null;

    const { rows: updatedRows } = await pool.query(
      `UPDATE requisitions
       SET client_name=$1, requirement_id=$2, job_title=$3, status=$4, slots=$5,
           assigned_recruiter=$6, working=$7, locked_by=$8
       WHERE id=$9 RETURNING *`,
      [client_name, requirement_id, job_title, status, slots, assigned_recruiter, working, locked_by, id]
    );

    io.emit("row-updated", updatedRows[0]);
    res.json(updatedRows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Database update error" }); }
});

app.post("/api/requisitions", async (req, res) => {
  try {
    const { client_name, requirement_id, job_title, status, slots } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO requisitions
         (client_name, requirement_id, job_title, status, slots, working, assigned_recruiter, locked_by)
       VALUES ($1,$2,$3,$4,$5,false,'',NULL)
       RETURNING *`,
      [client_name || "", requirement_id || "", job_title || "", status || "Open", slots || 1]
    );
    io.emit("row-added", rows[0]);
    res.json(rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: "Database insert error" }); }
});

app.get("/*", (req, res) => res.sendFile(path.join(__dirname, "../frontend/build/index.html")));

server.listen(process.env.PORT || 5000, () => console.log(`Server running on port ${process.env.PORT || 5000}`));
