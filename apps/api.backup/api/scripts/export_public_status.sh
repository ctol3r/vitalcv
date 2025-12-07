#!/usr/bin/env bash
set -e

echo "📦 Exporting public status vanity site..."

# Create dist directory
mkdir -p dist/public-status

# Copy HTML file
cp -f public-status/index.html dist/public-status/index.html

# Inject a random nonce so CSP passes (best-effort)
NONCE=$(date +%s%N | md5sum | cut -c1-16)
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS (BSD sed)
  sed -i '' "s/__NONCE__/${NONCE}/g" dist/public-status/index.html
else
  # Linux (GNU sed)
  sed -i "s/__NONCE__/${NONCE}/g" dist/public-status/index.html
fi

echo "✅ PUBLIC_STATUS_OK - exported to dist/public-status/"
echo ""
echo "Next steps:"
echo "  1. Upload dist/public-status/ to your CDN (S3, Netlify, Vercel, etc.)"
echo "  2. Point status.yourdomain.com to the bucket/site"
echo "  3. Enjoy your vanity status page! 💚"

