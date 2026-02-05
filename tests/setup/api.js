import { beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_DB_PATH = join(__dirname, '../test.db');

export let testDb;
export let testApp;
export let testServer;

beforeAll(async () => {
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }

    testDb = new Database(TEST_DB_PATH);
    testDb.pragma('foreign_keys = ON');

    testDb.exec(`
        CREATE TABLE IF NOT EXISTS connectors (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            config TEXT NOT NULL,
            status TEXT DEFAULT 'unknown',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
            status TEXT DEFAULT 'active',
            last_run DATETIME,
            last_run_status TEXT,
            next_run DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE TABLE IF NOT EXISTS backup_history (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            job_name TEXT NOT NULL,
            start_time DATETIME NOT NULL,
            end_time DATETIME,
            status TEXT DEFAULT 'running',
            size INTEGER,
            files_processed INTEGER,
            destination TEXT,
            backup_location TEXT,
            error TEXT
        );
        
        CREATE TABLE IF NOT EXISTS available_backups (
            id TEXT PRIMARY KEY,
            job_id TEXT NOT NULL,
            job_name TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            size INTEGER,
            encrypted INTEGER DEFAULT 0,
            compressed INTEGER DEFAULT 0,
            location TEXT,
            expires_at DATETIME
        );
    `);

    global.__testDb = testDb;
});

beforeEach(() => {
    testDb.exec('DELETE FROM backup_history');
    testDb.exec('DELETE FROM available_backups');
    testDb.exec('DELETE FROM jobs');
    testDb.exec('DELETE FROM connectors');
});

afterAll(() => {
    testDb.close();
    if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
    }
});
