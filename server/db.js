import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DATABASE_PATH || join(__dirname, 'arkvault.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    config TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected',
    last_tested TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    source_connector_id TEXT,
    source_config TEXT,
    destination_type TEXT NOT NULL,
    destination_connector_id TEXT,
    destination_config TEXT,
    schedule TEXT NOT NULL,
    schedule_description TEXT,
    retention INTEGER DEFAULT 30,
    compression INTEGER DEFAULT 1,
    encryption INTEGER DEFAULT 1,
    format TEXT DEFAULT 'zip',
    incremental INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    last_run TEXT,
    last_run_status TEXT,
    next_run TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    job_name TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    status TEXT DEFAULT 'running',
    size INTEGER DEFAULT 0,
    files_processed INTEGER DEFAULT 0,
    destination TEXT,
    error TEXT,
    backup_location TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS available_backups (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    job_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    encrypted INTEGER DEFAULT 0,
    compressed INTEGER DEFAULT 0,
    location TEXT NOT NULL,
    checksum TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auth_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash TEXT NOT NULL,
    must_change_password INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO auth_settings (id, password_hash, must_change_password)
  VALUES (1, '$2b$10$w1QUlPvwXKkY4.Ax2oH1N.z1UzlH2npyT75zSJAL9txWqz.auUWv.', 1);

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    must_change_password INTEGER DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO users (id, username, password_hash, role, must_change_password)
  VALUES ('00000000-0000-0000-0000-000000000001', 'admin', '$2b$10$w1QUlPvwXKkY4.Ax2oH1N.z1UzlH2npyT75zSJAL9txWqz.auUWv.', 'admin', 1);

  CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes TEXT DEFAULT '[]',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    revoked INTEGER DEFAULT 0
  );
`);

try {
  db.exec("ALTER TABLE available_backups ADD COLUMN checksum TEXT");
} catch {
  // column already exists
}

export default db;
