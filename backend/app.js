import express from "express";
import cors from "cors";
import path from "path";
import Database from "better-sqlite3";

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend build
app.use(express.static(path.join(process.cwd(), "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// SQLite DB
const db = new Database("db.sqlite");
db.prepare(`
  CREATE TABLE IF NOT EXISTS requisitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    working TEXT,
    assigned_recruiter TEXT
  )
`).run();

// API routes
app.get("/api/requisitions", (req, res) => {
  const rows = db.prepare("SELECT * FROM requisitions").all();
  res.json(rows);
});

app.post("/api/requisitions", (req, res) => {
  const { name, working, assigned_recruiter } = req.body;
  db.prepare(
    "INSERT INTO requisitions (name, working, assigned_recruiter) VALUES (?, ?, ?)"
  ).run(name, working, assigned_recruiter);
  res.json({ success: true });
});

app.put("/api/requisitions/:id", (req, res) => {
  const { working, assigned_recruiter } = req.body;
  const { id } = req.params;
  const resetRecruiter = working.toLowerCase() !== "yes" ? "" : assigned_recruiter;
  db.prepare(
    "UPDATE requisitions SET working = ?, assigned_recruiter = ? WHERE id = ?"
  ).run(working.charAt(0).toUpperCase() + working.slice(1).toLowerCase(), resetRecruiter, id);
  res.json({ success: true });
});

app.listen(5000, () => console.log("Backend running on port 5000"));
