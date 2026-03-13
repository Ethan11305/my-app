import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("votes.db");

// Initialize database and handle schema migration
const tableInfo = db.prepare("PRAGMA table_info(votes)").all() as { name: string }[];
const hasVoterName = tableInfo.some(col => col.name === 'voter_name');
const hasDayColumn = tableInfo.some(col => col.name === 'day');

// If it has voter_name (new version) or lacks day (very old version), drop and recreate
if (tableInfo.length > 0 && (hasVoterName || !hasDayColumn)) {
  console.log("Migration or revert detected, resetting database schema...");
  db.exec("DROP TABLE votes");
}

db.exec(`
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    submission_id TEXT NOT NULL,
    day TEXT NOT NULL,
    slot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/votes", (req, res) => {
    const counts = db.prepare(`
      SELECT day, slot, COUNT(*) as count 
      FROM votes 
      GROUP BY day, slot
    `).all() as { day: string; slot: string; count: number }[];

    res.json(counts);
  });

  app.post("/api/votes", (req, res) => {
    const { selections } = req.body; // Array of { day, slot }
    if (!Array.isArray(selections) || selections.length === 0) {
      return res.status(400).json({ error: "Invalid selections" });
    }

    const submissionId = Math.random().toString(36).substring(2, 15);
    const insert = db.prepare("INSERT INTO votes (submission_id, day, slot) VALUES (?, ?, ?)");
    
    const transaction = db.transaction((items) => {
      for (const item of items) {
        insert.run(submissionId, item.day, item.slot);
      }
    });

    transaction(selections);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
