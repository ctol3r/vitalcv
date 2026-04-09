#!/bin/bash
# scripts/launch-gate.sh
# Boring reliability: Verifies the Next.js production build can actually start and serve traffic.

set -e

echo "🔒 Starting Launch-Gate Smoke Test..."

cd apps/web || exit 1

# Start the production server in the background
echo "🚀 Starting Next.js production server on port 3000..."
PORT=3000 pnpm start > /dev/null 2>&1 &
SERVER_PID=$!

# Function to clean up the background process on exit
cleanup() {
  echo "🧹 Shutting down production server (PID: $SERVER_PID)..."
  kill -9 $SERVER_PID 2>/dev/null || true
}
trap cleanup EXIT

# Wait for server to boot up
echo "⏳ Waiting for server to become ready (max 30s)..."
MAX_RETRIES=15
RETRY_COUNT=0
SERVER_READY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s -f http://localhost:3000 > /dev/null; then
    SERVER_READY=true
    break
  fi
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$SERVER_READY" = false ]; then
  echo "❌ Launch-Gate Failed: Next.js server did not respond on port 3000."
  exit 1
fi

echo "✅ Next.js server is responding!"

# Quick health check endpoints (assuming /status or / are standard)
echo "🔍 Checking core routes..."
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" http://localhost:3000/)

if [ "$HTTP_STATUS" != "200" ]; then
  echo "❌ Launch-Gate Failed: Homepage returned HTTP $HTTP_STATUS (expected 200)."
  exit 1
fi

echo "✅ Launch-Gate Passed: Homepage returned 200 OK."
echo "🚢 Production build is verified and ready for deploy."
exit 0
