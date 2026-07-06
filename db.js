const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('Connected to SQLite database (better-sqlite3)');

function initTables() {
  // Employees table
  db.exec(`CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT UNIQUE,
    telegram_username TEXT,
    full_name TEXT,
    phone TEXT,
    is_active INTEGER DEFAULT 1,
    open_task_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Add new columns if they don't exist (for migration from v1)
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN telegram_username TEXT`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.exec(`ALTER TABLE employees ADD COLUMN open_task_id INTEGER`);
  } catch (e) {
    // Column already exists
  }

  // Tasks table (replaces records table)
  db.exec(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER,
    note_text TEXT,
    status TEXT DEFAULT 'unread',
    accountant_note TEXT,
    amount REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    done_at TEXT,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )`);

  // Task photos table
  db.exec(`CREATE TABLE IF NOT EXISTS task_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    file_path TEXT,
    file_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  )`);

  // Add file_id column if it doesn't exist (for duplicate prevention)
  try {
    db.exec(`ALTER TABLE task_photos ADD COLUMN file_id TEXT`);
  } catch (e) {
    // Column already exists
  }

  // Task voices table
  db.exec(`CREATE TABLE IF NOT EXISTS task_voices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER,
    file_path TEXT,
    duration_seconds INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
  )`);

  // Archived tasks table
  db.exec(`CREATE TABLE IF NOT EXISTS archived_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_task_id INTEGER,
    employee_name TEXT,
    employee_phone TEXT,
    note_text TEXT,
    accountant_note TEXT,
    amount REAL,
    photo_count INTEGER,
    voice_count INTEGER,
    task_created_at TEXT,
    task_done_at TEXT,
    archived_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  console.log('Database tables initialized');
}

initTables();

module.exports = db;
