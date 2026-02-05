# Stage 1: Build frontend
FROM node:20-alpine AS builder
# Install build tools for native modules (bcrypt, better-sqlite3)
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Install production dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy artifacts
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
# Server source needs to be copied. Assuming server/ is where backend code lives.
COPY --chown=node:node server ./server
# package.json is often needed for scripts or version info
COPY --chown=node:node package.json ./

# Create data directory with correct permissions for the node user
RUN mkdir -p /app/data && chown -R node:node /app/data

# Setup environment
ENV PORT=3001
ENV DATABASE_PATH=/app/data/arkvault.db
EXPOSE 3001

# Switch to non-root user
USER node

HEALTHCHECK --interval=30s --timeout=3s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]
