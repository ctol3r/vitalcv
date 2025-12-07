#!/bin/bash
# Quick PostgreSQL setup script for agent system

set -e

echo "🚀 Setting up PostgreSQL for Agent System..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "⚠️  Docker daemon is not running. Please start Docker Desktop and try again."
  echo ""
  echo "On macOS:"
  echo "  1. Open Docker Desktop application"
  echo "  2. Wait for it to start"
  echo "  3. Run this script again"
  exit 1
fi

# Check if container already exists
if docker ps -a | grep -q chai-vc-postgres; then
  echo "📦 Existing container found, starting it..."
  docker start chai-vc-postgres > /dev/null 2>&1 || echo "Container already running"
else
  echo "📦 Creating new PostgreSQL container..."
  docker run --name chai-vc-postgres \
    -e POSTGRES_PASSWORD=postgres \
    -e POSTGRES_DB=chai_vc \
    -p 5432:5432 \
    -d postgres:15-alpine

  echo "⏳ Waiting for PostgreSQL to be ready..."
  sleep 3

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

echo "✅ PostgreSQL is running!"
echo ""
echo "📋 Next steps:"
echo "  cd backend"
echo "  npx prisma migrate dev --name add_agent_system"
echo "  npx prisma generate"
echo ""

