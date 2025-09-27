import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Resolve __dirname in ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve React frontend build
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Example API route
app.get("/api/test", (req, res) => {
  res.json({ message: "API working!" });
});

// TODO: Add your database integration & other API routes here
// Example: CRUD routes for "requisitions", "working", "assigned recruiter", etc.

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
