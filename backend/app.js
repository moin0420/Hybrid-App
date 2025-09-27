import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import express from 'express';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;

// Serve React build
app.use(express.static(path.join(path.resolve(), '../frontend/build')));

// Initialize DB
const db = await open({
  filename: './database.db',
  driver: sqlite3.Database
});

// Sample route
app.get('/api/data', async (req, res) => {
  const rows = await db.all('SELECT * FROM table_name');
  res.json(rows);
});

// Serve React for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(path.resolve(), '../frontend/build', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));