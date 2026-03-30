# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy all workspace package.json files for dependency resolution
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

# Install all dependencies (including devDependencies for build)
RUN npm ci --legacy-peer-deps

# Copy monorepo configs and source files
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY apps/api/src ./apps/api/src

# Bundle with esbuild (transpile-only, no type-checking — CI handles that)
RUN npx esbuild apps/api/src/index.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outdir=apps/api/dist \
  --format=cjs \
  --external:pg-native \
  --external:@opentelemetry/* \
  --sourcemap

# ─── Stage 2: Production ──────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy workspace package.json files for production install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci --legacy-peer-deps --omit=dev

# Copy bundled output from builder stage
COPY --from=builder /app/apps/api/dist ./dist

# Set file ownership to non-root user
RUN chown -R nodeuser:nodejs /app

# Switch to non-root user
USER nodeuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
