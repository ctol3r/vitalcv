#!/bin/bash
# Script to verify the monorepo build

set -e

echo "🔍 Verifying monorepo build..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
  echo "❌ pnpm is not installed. Please install pnpm first."
  exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  pnpm install
fi

# Type check
echo ""
echo "🔷 Running type check..."
pnpm typecheck || {
  echo "⚠️  Type check failed. Fix errors before proceeding."
  exit 1
}

# Build packages first
echo ""
echo "🔷 Building shared packages..."
pnpm turbo run build --filter='./packages/*' || {
  echo "⚠️  Package build failed."
  exit 1
}

# Build apps
echo ""
echo "🔷 Building apps..."
pnpm turbo run build --filter='@vitalcv/api' --filter='@vitalcv/web' || {
  echo "⚠️  App build failed."
  exit 1
}

echo ""
echo "✅ Build verification complete!"
echo ""
echo "📊 Summary:"
echo "  - Type check: ✅"
echo "  - Packages built: ✅"
echo "  - Apps built: ✅"

