# Deployment Guide 🚀

This guide provides detailed instructions for deploying ArkVault in a production environment.

## Prerequisites

- **Docker** (24.0.0 or later)
- **Docker Compose** (v2.0.0 or later)
- **Host System**: Linux (recommended for NFS support)

## Production Quick Start

1. **Clone the repository**:
   ```bash
   git clone https://github.com/arkaitz97/arkvault.git
   cd arkvault
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and update the values:
   ```bash
   cp .env.example .env
   ```
   **Crucial Settings**:
   - `SESSION_SECRET`: Generate a strong random string (e.g., `openssl rand -base64 32`).
   - `ALLOWED_ORIGINS`: Set to your actual domain name.
   - `NODE_ENV`: Set to `production`.

3. **Launch with Docker Compose**:
   ```bash
   docker compose up -d
   ```

## Production Architecture

ArkVault's `docker-compose.yml` is pre-configured for production with:

- **Resource Limits**: 
  - CPUs: 0.5 (limit), 0.1 (reservation)
  - Memory: 512MB (limit), 128MB (reservation)
- **Log Rotation**: JSON-file driver with 10MB max size and 3 file rotation.
- **Persistent Storage**:
  - `backup-data`: Named volume for the SQLite database.
  - `backup-logs`: Named volume for application logs.
- **Auto-Restart**: Containers are set to `restart: unless-stopped`.

## Security Considerations

### Elevated Privileges for NFS
To support NFS mounting, the container requires specific Linux capabilities:
```yaml
cap_add:
  - SYS_ADMIN
  - DAC_READ_SEARCH
security_opt:
  - apparmor:unconfined
```
Ensure your host environment allows these operations.

### Non-Root User
The application runs as the `node` user (UID 1000) inside the container for better security. Directories `/app/data` and `/app/logs` are owned by this user.

### HTTPS
In production, it is highly recommended to run ArkVault behind a reverse proxy (like Nginx, Caddy, or Traefik) that handles SSL termination.
If using HTTPS, set `SECURE_COOKIES=true` in your `.env` file.

## Monitoring & Health

- **Healthcheck**: The container includes a built-in healthcheck that monitors the `/api/health` endpoint.
- **Status Checks**:
  ```bash
  docker ps              # Check container status
  docker compose logs -f # View real-time logs
  ```

## Troubleshooting

- **Database Issues**: Ensure the `backup-data` volume is correctly mounted and hasn't run out of space.
- **NFS Failures**: Check if `nfs-utils` is installed on the host and if the container has the required capabilities.
- **Port Conflicts**: If port 3001 is already in use, modify the `ports` section in `docker-compose.yml`.
