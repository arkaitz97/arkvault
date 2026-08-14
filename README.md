# ArkVault 🛡️

A modern, self-hosted backup management application with support for multiple storage backends.

![Version](https://img.shields.io/badge/version-0.1.0-orange.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

<a href='https://ko-fi.com/U7U01TPY4Q' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi5.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

ArkVault simplifies your backup strategy with a unified interface for Local, NFS, SSH, S3, and Google Drive storage. Built with React 19 and Node.js, it provides automated retention, real-time status monitoring, and easy point-in-time restoration.

## Features

- 🔌 **Multiple Connectors** - Local folders, NFS, SSH/SFTP hosts, S3-compatible storage, Google Drive, PostgreSQL
- 📅 **Scheduled Backups** - Cron-based scheduling with flexible options
- 🔄 **Easy Restore** - Browse and restore from any backup point
- 📊 **Dashboard** - Real-time overview of backup status and history
- 🔐 **Encryption** - Optional backup encryption
- 📦 **Compression** - Reduce storage with ZIP compression
- 🎯 **Retention Policies** - Automatic cleanup of old backups
- 🛡️ **Security First** - Built-in protection with Helmet, Rate Limiting, and Path Validation


## Quick Start

### Production Deployment

For production environments, please refer to our comprehensive **[Deployment Guide](DEPLOYMENT.md)**.

### Quick Start (Local)

```bash
docker compose up -d
```

Access the app at `http://localhost:5173`

### Manual Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/backup-app.git
cd backup-app

# Install dependencies
npm install

# Start both frontend and backend
npm run start
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Developer Helper Scripts

| Command | Description |
|---------|-------------|
| `npm run s3:start` | Start a local MinIO (S3) container for testing |
| `npm run s3:stop` | Stop and remove the MinIO container |
| `npm run nfs:start` | Start a local NFS server container for testing |
| `npm run nfs:stop` | Stop and remove the NFS server container |
| `npm run db:reset` | Reset the database authentication (admin/admin123) |


## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `DATABASE_PATH` | `./server/arkvault.db` | SQLite database location |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated list of allowed CORS origins |
| `SESSION_SECRET` | `backup-app-secret-change-me-in-production` | Secret used to sign session cookies |
| `NODE_ENV` | `development` | Set to `production` for secure cookie handling |
| `LOG_LEVEL` | `info` | Logging verbosity (silent, fatal, error, warn, info, debug, trace) |
| `LOG_FILE` | (none) | Path to log file. If set, logs to both file and console |

### Logs

When running with Docker, logs are persisted in a named volume `backup-logs`. By default, they are written to `/app/logs/arkvault.log` inside the container.

To view logs:
- **Console**: `docker logs arkvault`
- **File**: `docker exec arkvault cat /app/logs/arkvault.log`

### Connector Types

| Type | Source | Destination | Description |
|------|--------|-------------|-------------|
| **Local** | ✅ | ✅ | Local filesystem folders |
| **NFS** | ✅ | ✅ | Network File System mounts. **See [NFS Support](#nfs-support) for setup.** |
| **SSH** | ✅ | ✅ | Remote hosts over SFTP (`ssh2`), password or private-key auth |
| **S3** | ✅ | ✅ | S3-compatible storage (AWS, MinIO, etc.) |
| **Google Drive** | ✅ | ✅ | Google Drive with OAuth |
| **PostgreSQL** | ✅ | ❌ | Database dumps (pg_dump) |

### NFS Support

To use NFS connectors within Docker, the container requires elevated privileges to perform mount operations. The default `docker-compose.yml` is configured with:

- `cap_add: [SYS_ADMIN, DAC_READ_SEARCH]`
- `security_opt: [apparmor:unconfined]`

Ensure the host machine has `nfs-common` (Debian/Ubuntu) or `nfs-utils` (RHEL/CentOS/Alpine) installed if you are mounting shares on the host directly, but for the Docker container layout, the necessary client tools are included in the image.

**Note:** NFS mounting requires the container to run in privileged mode or with the specific capabilities enabled as shown above.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/connectors` | GET/POST | List/create connectors |
| `/api/jobs` | GET/POST | List/create backup jobs |
| `/api/backups/run/:jobId` | POST | Trigger manual backup |
| `/api/backups/history` | GET | Get backup history |
| `/api/backups/restore/:id` | POST | Restore from backup |

## Security Features

ArkVault includes several layers of security to protect your data and the application:

- **HTTP Security Headers**: Uses [Helmet](https://helmetjs.github.io/) to set secure HTTP headers, including Content Security Policy (CSP), HSTS, and Frameguard.
- **Rate Limiting**: Protects against brute-force and DoS attacks with granular rate limits for authentication, general API usage, and file downloads.
- **Path Validation**: Strict validation for all connector paths to prevent path traversal vulnerabilities.
- **Secure Sessions**: Signed session cookies with `HttpOnly` and `SameSite: Lax` attributes. In production, `Secure` flag is enforced.
- **CORS Protection**: Configurable allowed origins to prevent unauthorized cross-origin requests.


## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons
- **Backend**: Node.js, Express 5, SQLite
- **Scheduler**: node-cron

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
