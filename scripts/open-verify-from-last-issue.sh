#!/bin/bash

# Helper script to open verify page from last issued credential
# This script reads from /tmp/issue.json and opens the verify page

ISSUE_FILE="/tmp/issue.json"
FRONTEND_URL="http://localhost:3005"

# Check if issue file exists
if [ ! -f "$ISSUE_FILE" ]; then
    echo "❌ No issue file found at $ISSUE_FILE"
    echo "   Make sure you've issued a credential first."
    exit 1
fi

# Read the issue data
if ! command -v jq &> /dev/null; then
    echo "❌ jq is required but not installed. Please install jq first."
    echo "   On macOS: brew install jq"
    echo "   On Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Extract credential ID and JWT
CREDENTIAL_ID=$(jq -r '.credentialId' "$ISSUE_FILE")
JWT=$(jq -r '.jwt' "$ISSUE_FILE")

if [ "$CREDENTIAL_ID" = "null" ] || [ -z "$CREDENTIAL_ID" ]; then
    echo "❌ No credential ID found in issue file"
    exit 1
fi

echo "🔍 Found credential: $CREDENTIAL_ID"
echo "🌐 Opening verify page..."

# Open the verify page with the JWT parameter
if [ "$JWT" != "null" ] && [ -n "$JWT" ]; then
    # Use JWT if available
    VERIFY_URL="${FRONTEND_URL}/verify?jwt=${JWT}"
    echo "   Using JWT: ${JWT:0:50}..."
else
    # Fallback to credential ID
    VERIFY_URL="${FRONTEND_URL}/verify?jwt=${CREDENTIAL_ID}"
    echo "   Using credential ID: $CREDENTIAL_ID"
fi

# Open in browser
if command -v open &> /dev/null; then
    # macOS
    open "$VERIFY_URL"
elif command -v xdg-open &> /dev/null; then
    # Linux
    xdg-open "$VERIFY_URL"
elif command -v start &> /dev/null; then
    # Windows
    start "$VERIFY_URL"
else
    echo "❌ No browser command found. Please open this URL manually:"
    echo "   $VERIFY_URL"
    exit 1
fi

echo "✅ Verify page opened successfully!"

