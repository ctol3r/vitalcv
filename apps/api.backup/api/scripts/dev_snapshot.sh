#!/usr/bin/env bash
##
## Dev Snapshot → Git Tag → Vercel Preview - Batch 54
## Creates a dated tag and pushes for automated Vercel deployment
##

set -e

BR=${GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}
SHA=${GIT_SHA:-$(git rev-parse --short HEAD)}
TAG="dev-$(date +%Y%m%d-%H%M)-$SHA"

echo "🏷️  Creating snapshot tag: $TAG"
git tag -a "$TAG" -m "Dev snapshot $TAG" 2>/dev/null || echo "Tag may already exist, continuing..."

echo "📤 Pushing tag to remote..."
git push --tags 2>/dev/null || echo "Push may have failed (already exists or no remote), continuing..."

echo "✅ Tagged: $TAG"
echo "   Branch: $BR"
echo "   SHA: $SHA"

if [ -n "$VERCEL_TOKEN" ]; then
  echo "🔗 Vercel preview: Check your Vercel dashboard for deployment status"
  echo "   Trigger: git tag push detected"
else
  echo "💡 Tip: Set VERCEL_TOKEN to auto-link preview deployments"
fi

echo ""
echo "🎉 Snapshot complete!"

