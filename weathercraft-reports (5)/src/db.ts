import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'weathercraft.db'));

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    minecraft_uuid TEXT UNIQUE,
    username TEXT,
    avatar_url TEXT,
    verification_code TEXT,
    skin_hash TEXT,
    verification_expires DATETIME,
    verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    city TEXT NOT NULL,
    time TEXT NOT NULL,
    effective_until TEXT NOT NULL,
    type TEXT NOT NULL,
    clouds TEXT,
    moisture TEXT NOT NULL,
    act_kind TEXT NOT NULL,
    damage_classification TEXT NOT NULL,
    photo_url TEXT,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

export default db;
