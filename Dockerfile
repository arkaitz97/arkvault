# Stage 1: Build frontend
FROM node:26-alpine AS builder
# Install build tools for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Install production dependencies
FROM node:26-alpine AS deps
RUN apk add --no-cache python3 make g++ nfs-utils sudo
# Configure sudo for node user to run mount/umount without password
RUN echo "node ALL=(ALL) NOPASSWD: /bin/mount, /bin/umount, /usr/sbin/mount.nfs" >> /etc/sudoers

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production runner
FROM node:26-alpine AS runner

LABEL org.opencontainers.image.title="ArkVault" \
    org.opencontainers.image.description="Secure backup management system" \
    org.opencontainers.image.vendor="arkaitz97" \
    org.opencontainers.image.licenses="MIT"

WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies (nfs-utils and sudo for the NFS connector)
RUN apk add --no-cache nfs-utils sudo

# Configure sudo for node user to run mount/umount without password
RUN echo "node ALL=(ALL) NOPASSWD: /bin/mount, /bin/umount, /usr/sbin/mount.nfs" >> /etc/sudoers

# Copy artifacts from builder and deps stages
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node package.json ./

# Create data and logs directories and set permissions
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Setup environment
ENV PORT=3001
ENV DATABASE_PATH=/app/data/arkvault.db
ENV LOG_FILE=/app/logs/arkvault.log

EXPOSE 3001

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
