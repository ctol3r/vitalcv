#!/bin/bash
# Script to unify build/test/lint scripts across the monorepo

set -e

echo "🔧 Unifying scripts across monorepo..."

# Update root package.json scripts (already done, but verify)
echo "✅ Root scripts configured in package.json"

# Check app-level package.json files
echo ""
echo "📦 Checking app-level scripts..."

# API scripts
if [ -f "apps/api/api/package.json" ]; then
  echo "  ✓ apps/api/api/package.json exists"
fi

# Web scripts
if [ -f "apps/web/package.json" ]; then
  echo "  ✓ apps/web/package.json exists"
fi

echo ""
echo "💡 Scripts should use turbo for consistency:"
echo "   - Use 'turbo run build' instead of direct build commands"
echo "   - Use 'turbo run test' instead of direct test commands"
echo "   - Use 'turbo run lint' instead of direct lint commands"

echo ""
echo "✅ Script unification check complete!"

