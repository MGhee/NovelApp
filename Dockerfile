# Multi-stage build for Next.js + better-sqlite3
# Stage 1: Dependencies
FROM node:20-bookworm-slim AS deps
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV DB_PATH=/app/data/novelapp.db
RUN npx prisma generate
RUN npm run build

# Stage 3: Runner
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    DB_PATH=/app/data/novelapp.db

RUN mkdir -p /app/data

# Copy built Next.js app and dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

VOLUME /app/data

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
