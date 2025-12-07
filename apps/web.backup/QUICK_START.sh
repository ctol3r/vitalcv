#!/bin/bash

# Chai VC Platform - Web App Quick Start
# This script helps you get the governance features up and running quickly

set -e  # Exit on error

echo "🚀 Chai VC Platform - Governance Features Quick Start"
echo "======================================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the apps/web directory"
    exit 1
fi

echo "✅ Running from correct directory"
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ required (current: $(node -v))"
    exit 1
fi

echo "✅ Node.js version check passed: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
echo "This may take a few minutes..."
npm install

echo ""
echo "✅ Dependencies installed successfully"
echo ""

# Create .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo "⚙️  Creating .env.local file..."
    cat > .env.local << EOF
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# Feature Flags
NEXT_PUBLIC_ENABLE_2FA=true
NEXT_PUBLIC_ENABLE_AUDIT_EXPORT=true
NEXT_PUBLIC_ENABLE_POLICY_MANAGEMENT=true
EOF
    echo "✅ .env.local created"
else
    echo "ℹ️  .env.local already exists, skipping"
fi

echo ""

# Run type check
echo "🔍 Running TypeScript type check..."
npm run type-check
echo "✅ Type check passed"
echo ""

# Build the application (optional, can be slow)
read -p "Do you want to build the production bundle now? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🏗️  Building production bundle..."
    npm run build
    echo "✅ Build completed successfully"
    echo ""
fi

echo "✨ Setup complete!"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start development server:"
echo "   npm run dev"
echo ""
echo "2. Open your browser to:"
echo "   http://localhost:3000/org/settings"
echo ""
echo "3. Available routes:"
echo "   - /org/settings              (Dashboard)"
echo "   - /org/settings/roles        (Roles & Permissions)"
echo "   - /org/settings/members      (Member Management)"
echo "   - /org/audit/accessLogs      (Access Logs)"
echo "   - /org/audit/export          (Audit Export)"
echo ""
echo "📚 Documentation:"
echo "   - README.md                  (Setup & architecture)"
echo "   - API_INTEGRATION_GUIDE.md   (API specifications)"
echo "   - DEPLOYMENT_CHECKLIST.md    (Deployment guide)"
echo ""
echo "⚡ Current mode: Using mock data"
echo "💡 To connect to real API: Update API endpoints in page files"
echo ""
echo "🎉 Happy coding!"

