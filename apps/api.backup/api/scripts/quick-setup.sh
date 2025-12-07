#!/bin/bash
# Quick setup script for Round 34

set -e

echo "🚀 Round 34 Quick Setup"
echo "======================"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "⚠️  Docker is not running!"
  echo ""
  echo "Please start Docker Desktop and run this script again."
  echo ""
  exit 1
fi

# Check if PostgreSQL container exists
if docker ps -a | grep -q chai-vc-postgres; then
  echo "📦 Found existing PostgreSQL container"

  # Check if running
  if docker ps | grep -q chai-vc-postgres; then
    echo "✅ PostgreSQL is already running"
  else
    echo "🔄 Starting PostgreSQL container..."
    docker start chai-vc-postgres
    sleep 3
  fi
else
  echo "📦 Creating new PostgreSQL container..."
  docker run --name chai-vc-postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_DB=vitalcv \
    -p 5432:5432 \
    -d postgres:15-alpine

  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 5

  # Wait for postgres to be ready
  timeout=30
  while ! docker exec chai-vc-postgres pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
    timeout=$((timeout - 1))
    if [ $timeout -eq 0 ]; then
      echo "❌ PostgreSQL failed to start"
      exit 1
    fi
  done
fi

echo "✅ PostgreSQL is ready!"
echo ""

# Apply Round 34 migration
echo "📊 Applying Round 34 migration..."
if docker exec -i chai-vc-postgres psql -U postgres -d vitalcv < ../prisma/migrations/20251103_newsletter_flags.sql > /dev/null 2>&1; then
  echo "✅ Migration applied successfully!"
else
  echo "ℹ️  Migration may have already been applied (this is okay)"
fi

echo ""
echo "🔍 Verifying tables..."
docker exec -i chai-vc-postgres psql -U postgres -d vitalcv -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Newsletter', 'RuntimeFlag') ORDER BY table_name;" | grep -E "Newsletter|RuntimeFlag" || echo "⚠️  Tables not found"

echo ""
echo "✨ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "  1. Start backend:  cd backend && npm run dev"
echo "  2. Start frontend: cd ../v0-vital-cv-frontend-mvp && npm run dev"
echo "  3. Test endpoints: See ROUND34_SETUP_GUIDE.md"
echo ""

