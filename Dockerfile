# Multi-stage build for optimized production image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript if present
RUN npm run build 2>/dev/null || echo "No build step"

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

LABEL maintainer="ChittyCorp"
LABEL description="ChittyOS CLI - AI-powered command-line interface with 100% compliance"
LABEL version="2.0.0"

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tini \
    ripgrep

# Create non-root user
RUN addgroup -g 1001 -S chittyos && \
    adduser -S chittyos -u 1001

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=chittyos:chittyos /app/node_modules ./node_modules
COPY --from=builder --chown=chittyos:chittyos /app/package*.json ./
COPY --from=builder --chown=chittyos:chittyos /app/dist ./dist 2>/dev/null || true
COPY --from=builder --chown=chittyos:chittyos /app/*.js ./
COPY --from=builder --chown=chittyos:chittyos /app/chittyos-* ./chittyos-*/
COPY --from=builder --chown=chittyos:chittyos /app/scripts ./scripts/
COPY --from=builder --chown=chittyos:chittyos /app/chittyid ./chittyid/
COPY --from=builder --chown=chittyos:chittyos /app/replit ./replit/
COPY --from=builder --chown=chittyos:chittyos /app/.env.example ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    CHITTY_ID_SERVICE=https://id.chitty.cc \
    CHITTYOS_FRAMEWORK_VERSION=1.0.1

# Create necessary directories
RUN mkdir -p /app/.chittyos /app/data /app/logs && \
    chown -R chittyos:chittyos /app/.chittyos /app/data /app/logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Switch to non-root user
USER chittyos

# Expose port
EXPOSE 3000

# Use tini for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command - run ChittyCLI
CMD ["node", "chitty.js", "--serve"]