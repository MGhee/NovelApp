#!/bin/sh
set -e

# Run migrations (idempotent for SQLite)
npx prisma migrate deploy

# Start the server
node server.js
