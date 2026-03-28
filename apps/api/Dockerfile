# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install all dependencies (including devDependencies for TypeScript compilation)
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy monorepo configs and source files
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src

# Compile TypeScript to JavaScript
RUN npx tsc --project apps/api/tsconfig.json --skipLibCheck

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --omit=dev

# Copy compiled output from builder stage
COPY --from=builder /app/apps/api/dist ./dist

# Set file ownership to non-root user
RUN chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
