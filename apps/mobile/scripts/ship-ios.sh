#!/usr/bin/env bash
# ship-ios.sh — fastest path from clean checkout to TestFlight build
#
# Prerequisites (one-time, human only):
#   1. Apple Developer Program enrollment ($99/yr) — https://developer.apple.com/programs/
#   2. App Store Connect app record created (bundle id: com.vitalcv.wallet)
#   3. Expo account: `npx eas-cli login`
#   4. EAS project linked: `npx eas-cli init` (writes projectId into app.json)
#   5. Replace placeholders in apps/mobile/app.json and apps/mobile/eas.json:
#        - REPLACE_WITH_EAS_PROJECT_ID
#        - REPLACE_WITH_EXPO_ACCOUNT
#        - REPLACE_WITH_APPLE_ID_EMAIL
#        - REPLACE_WITH_APP_STORE_CONNECT_APP_ID
#        - REPLACE_WITH_APPLE_TEAM_ID
#
# Usage: ./scripts/ship-ios.sh [preview|production]
set -euo pipefail

PROFILE="${1:-production}"
cd "$(dirname "$0")/.."

echo "==> Verifying placeholders are filled"
if grep -q "REPLACE_WITH_" app.json eas.json; then
  echo "ERROR: Unfilled placeholders in app.json or eas.json. Fill them before shipping."
  grep -n "REPLACE_WITH_" app.json eas.json
  exit 1
fi

echo "==> Typechecking"
pnpm typecheck

echo "==> Running tests"
pnpm test

echo "==> Building iOS ($PROFILE) on EAS cloud"
npx eas-cli build --platform ios --profile "$PROFILE" --non-interactive --wait

echo "==> Submitting to App Store Connect → TestFlight"
npx eas-cli submit --platform ios --profile "$PROFILE" --latest --non-interactive

echo ""
echo "Build submitted. Apple TestFlight processing typically takes 15-60 min."
echo "Promote to App Store: App Store Connect → My Apps → VitalCV Wallet → + Version → Submit for Review"
