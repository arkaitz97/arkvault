import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'backup.db'));

db.pragma('foreign_keys = ON');

db.exec(`
  -- Connectors table
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

  -- Backup jobs table
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
    status TEXT DEFAULT 'active',
    last_run TEXT,
    last_run_status TEXT,
    next_run TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  -- Backup history table
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

  -- Available backups (for restore)
  CREATE TABLE IF NOT EXISTS available_backups (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    job_name TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    size INTEGER DEFAULT 0,
    encrypted INTEGER DEFAULT 0,
    compressed INTEGER DEFAULT 0,
    location TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
  );
`);

export default db;
