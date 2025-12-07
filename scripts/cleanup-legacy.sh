#!/bin/bash
# Script to clean up legacy repository artifacts

set -e

echo "🧹 Cleaning up legacy repository artifacts..."

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Remove backup files
echo "  Removing backup files..."
find . -name "*.backup" -type f -delete 2>/dev/null || true
find . -name "*.old" -type f -delete 2>/dev/null || true
find . -name "*.bak" -type f -delete 2>/dev/null || true
find . -name "*~" -type f -delete 2>/dev/null || true

# Remove temporary files
echo "  Removing temporary files..."
find . -name "*.tmp" -type f -delete 2>/dev/null || true
find . -name "*.temp" -type f -delete 2>/dev/null || true

# Remove duplicate README files (keep only root and app-level)
echo "  Checking for duplicate README files..."
# This is informational - we'll keep READMEs for now

# Remove old lock files if pnpm-lock.yaml exists
if [ -f "pnpm-lock.yaml" ]; then
  echo "  Removing old lock files..."
  find . -name "package-lock.json" -type f -delete 2>/dev/null || true
  find . -name "yarn.lock" -type f -delete 2>/dev/null || true
fi

# Remove .DS_Store files (macOS)
echo "  Removing .DS_Store files..."
find . -name ".DS_Store" -type f -delete 2>/dev/null || true

# Remove empty directories (except important ones)
echo "  Removing empty directories..."
find . -type d -empty -not -path "./.git/*" -not -path "./node_modules/*" -delete 2>/dev/null || true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "💡 Remaining cleanup tasks (manual):"
echo "  - Review and consolidate duplicate README files"
echo "  - Remove unused configuration files"
echo "  - Archive old documentation if needed"

