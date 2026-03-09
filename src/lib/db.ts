import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../family.db');
export const db = new Database(dbPath);

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT
    );

    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      invite_code TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS household_members (
      user_id TEXT,
      household_id TEXT,
      role TEXT CHECK(role IN ('admin', 'member', 'child', 'guest')),
      PRIMARY KEY (user_id, household_id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (household_id) REFERENCES households(id)
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      household_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT,
      assignee_id TEXT,
      priority TEXT CHECK(priority IN ('low', 'medium', 'high')) DEFAULT 'medium',
      category TEXT,
      points INTEGER DEFAULT 0,
      status TEXT CHECK(status IN ('todo', 'done')) DEFAULT 'todo',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      completed_by TEXT,
      FOREIGN KEY (household_id) REFERENCES households(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id),
      FOREIGN KEY (completed_by) REFERENCES users(id)
    );
  `);
  console.log('Database initialized');
}
