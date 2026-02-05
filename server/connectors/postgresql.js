import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);
const stat = promisify(fs.stat);
const rm = promisify(fs.rm);

class PostgreSQLConnector {
    buildConnectionEnv(config) {
        return {
            PGHOST: config.host || 'localhost',
            PGPORT: String(config.port || 5432),
            PGDATABASE: config.database,
            PGUSER: config.username,
            PGPASSWORD: config.password,
            ...process.env
        };
    }

    async testConnection(config) {
        try {
            const env = this.buildConnectionEnv(config);

            await execAsync('psql -c "SELECT 1"', { env, timeout: 10000 });

            return { success: true, message: 'Connection successful' };
        } catch (error) {
            try {
                const { host, port, database, username } = config;
                await execAsync(
                    `pg_isready -h ${host || 'localhost'} -p ${port || 5432} -d ${database} -U ${username}`,
                    { timeout: 10000 }
                );
                return { success: true, message: 'Connection successful' };
            } catch {
                return { success: false, error: error.message };
            }
        }
    }

    async backup(config, options = {}) {
        const env = this.buildConnectionEnv(config);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pg-backup-${config.database}-${timestamp}.sql`;
        const tempPath = path.join('/tmp', filename);
        const compressedPath = options.compression ? `${tempPath}.gz` : tempPath;

        try {
            let command = `pg_dump --format=plain`;

            if (options.compression) {
                command += ` | gzip > "${compressedPath}"`;
            } else {
                command += ` > "${tempPath}"`;
            }

            await execAsync(command, { env, timeout: 3600000 });

            const outputPath = options.compression ? compressedPath : tempPath;
            const fileStats = await stat(outputPath);

            return {
                data: outputPath,
                filename: options.compression ? `${filename}.gz` : filename,
                size: fileStats.size,
                filesProcessed: 1,
                isFile: true
            };
        } catch (error) {
            await rm(tempPath, { force: true });
            await rm(compressedPath, { force: true });
            throw error;
        }
    }

    async upload(_sourcePath, _filename, _config) {
        throw new Error('PostgreSQL cannot be used as a backup destination');
    }

    async download(_location, _config) {
        throw new Error('PostgreSQL cannot be used as a restore source directly');
    }

    async restore(backupData, options) {
        const config = options;
        const env = this.buildConnectionEnv(config);

        let command;
        if (backupData.path.endsWith('.gz')) {
            command = `gunzip -c "${backupData.path}" | psql`;
        } else {
            command = `psql < "${backupData.path}"`;
        }

        try {
            await execAsync(command, { env, timeout: 3600000 });
            return {
                success: true,
                filesRestored: 1
            };
        } catch (error) {
            throw new Error(`Restore failed: ${error.message}`);
        }
    }
}

export default PostgreSQLConnector;
