# ArkVault

A modern, self-hosted backup management application with support for multiple storage backends.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

## Features

- 🔌 **Multiple Connectors** - Local folders, NFS, S3-compatible storage, Google Drive, PostgreSQL
- 📅 **Scheduled Backups** - Cron-based scheduling with flexible options
- 🔄 **Easy Restore** - Browse and restore from any backup point
- 📊 **Dashboard** - Real-time overview of backup status and history
- 🔐 **Encryption** - Optional backup encryption
- 📦 **Compression** - Reduce storage with ZIP compression
- 🎯 **Retention Policies** - Automatic cleanup of old backups

## Quick Start

### Using Docker (Recommended)

```bash
docker-compose up -d
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

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend server port |
| `DATABASE_PATH` | `./data/backup.db` | SQLite database location |

### Connector Types

| Type | Source | Destination | Description |
|------|--------|-------------|-------------|
| **Local** | ✅ | ✅ | Local filesystem folders |
| **NFS** | ✅ | ✅ | Network File System mounts |
| **S3** | ✅ | ✅ | S3-compatible storage (AWS, MinIO, etc.) |
| **Google Drive** | ✅ | ✅ | Google Drive with OAuth |
| **PostgreSQL** | ✅ | ❌ | Database dumps (pg_dump) |

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/connectors` | GET/POST | List/create connectors |
| `/api/jobs` | GET/POST | List/create backup jobs |
| `/api/backups/run/:jobId` | POST | Trigger manual backup |
| `/api/backups/history` | GET | Get backup history |
| `/api/backups/restore/:id` | POST | Restore from backup |

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons
- **Backend**: Node.js, Express 5, SQLite
- **Scheduler**: node-cron

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.
