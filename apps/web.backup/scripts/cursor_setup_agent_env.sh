#!/usr/bin/env bash
# V0 Frontend Agent Environment Setup

set -e

echo "🎨 Setting up V0 Frontend for Agent Integration..."

# Check if ngrok URL exists from backend
if [ -f /tmp/vitalcv_env_snippet.txt ]; then
    echo "📋 Found backend ngrok configuration"

    # Read the ngrok URL
    source /tmp/vitalcv_env_snippet.txt

    # Create or update .env.local
    ENV_FILE=".env.local"

    echo "📝 Writing to $ENV_FILE..."

    # Backup existing .env.local if it exists
    if [ -f "$ENV_FILE" ]; then
        cp "$ENV_FILE" "$ENV_FILE.backup.$(date +%s)"
        echo "💾 Backed up existing $ENV_FILE"
    fi

    # Write agent configuration
    cat > "$ENV_FILE" <<EOF
# VitalCV Agent Configuration
# Generated: $(date)

# Backend Agent URL (from ngrok)
NEXT_PUBLIC_AGENT_BASE=$NEXT_PUBLIC_AGENT_BASE
NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
NEXT_PUBLIC_AGENT_PREVIEW=1

# Optional: Additional configuration
# NEXT_PUBLIC_ENABLE_ANALYTICS=false
EOF

    echo "✅ Environment configured!"
    echo ""
    echo "═══════════════════════════════════════════════════════════"
    echo "Configuration written to .env.local:"
    cat "$ENV_FILE"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "🚀 Next steps:"
    echo "1. Restart your dev server: npm run dev"
    echo "2. Visit: http://localhost:3000/agent"
    echo "3. Test with preset: 'Verify License'"
    echo ""

else
    echo "❌ No ngrok configuration found!"
    echo ""
    echo "Please run the backend tunnel setup first:"
    echo "  cd /Users/christoler/backend"
    echo "  bash scripts/cursor_setup_agent_tunnel.sh"
    echo ""
    echo "Or manually set environment variables:"
    echo ""
    cat > .env.local <<EOF
# Manual Configuration Template
NEXT_PUBLIC_AGENT_BASE=YOUR_NGROK_URL/api/agent
NEXT_PUBLIC_API_URL=YOUR_NGROK_URL
NEXT_PUBLIC_AGENT_PREVIEW=1
EOF
    echo "📝 Created template .env.local - please update with your ngrok URL"
fi

echo ""
echo "📚 Testing URLs:"
echo "  Agent UI:     http://localhost:3000/agent"
echo "  Verify Page:  http://localhost:3000/verify"
echo "  Admin Panel:  http://localhost:3000/admin/traces"

