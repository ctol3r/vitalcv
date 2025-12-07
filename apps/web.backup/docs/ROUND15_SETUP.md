# Round 15 Setup Guide

## Stakeholder-Ready Features

This round adds production-ready features for pilot deployments and stakeholder demos:

1. **Pilot Mode** - Freeze scope with safety locks
2. **5-Minute Demo Overlay** - Guided stakeholder presentations
3. **CISO Explain Panel** - Security posture summary
4. **Brand Polish** - Logo, slogan, and theme
5. **Mobile Wallet Export** - Stub installers for Apple/Google Wallet
6. **Backup & Export** - Configuration bundle downloads
7. **Rollback Controls** - End pilot / go-live toggle

## Environment Setup

### Frontend (.env.local)

```bash
# Copy example file
cp .env.example .env.local

# Key variables for Round 15:
NEXT_PUBLIC_PILOT_MODE=1                    # Enable pilot mode banner
NEXT_PUBLIC_AGENT_BASE=http://localhost:4000/api/agent
NEXT_PUBLIC_ENABLE_DEMO_OVERLAY=true
NEXT_PUBLIC_ENABLE_WALLET_EXPORT=true
```

### Backend (.env)

```bash
# Copy example file
cp .env.example .env

# Key variables for Round 15:
PILOT_MODE=1                                # Enable pilot mode guard
PUBLIC_ISSUER_URL=http://localhost:4000
SLO_P95_MS=2000                            # P95 latency SLO
```

## New Pages & Routes

### Frontend

- `/admin/ciso` - CISO security posture dashboard
- `/admin/backup` - Backup and export configuration bundles
- Demo Overlay available on `/agent` page

### Backend

- `GET /api/ciso/summary` - Security posture summary
- `GET /api/ciso/risk-matrix` - Risk assessment
- `GET /api/demo-overlay/script` - Demo script with steps
- `POST /api/demo-overlay/run-step` - Track demo progress
- `GET /api/rollback/pilot/status` - Check pilot mode status
- `POST /api/rollback/pilot/enable` - Enable pilot mode
- `POST /api/rollback/pilot/disable` - Disable pilot mode
- `POST /api/rollback/snapshot` - Create snapshot

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
cd v0-vital-cv-frontend-mvp
pnpm install

# Backend
cd chai-vc-platform/backend
pnpm install
```

### 2. Set Environment Variables

```bash
# Frontend
echo "NEXT_PUBLIC_PILOT_MODE=1" >> .env.local
echo "NEXT_PUBLIC_AGENT_BASE=http://localhost:4000/api/agent" >> .env.local

# Backend
echo "PILOT_MODE=1" >> .env
echo "PUBLIC_ISSUER_URL=http://localhost:4000" >> .env
```

### 3. Start Services

```bash
# Backend (terminal 1)
cd chai-vc-platform/backend
pnpm dev

# Frontend (terminal 2)
cd v0-vital-cv-frontend-mvp
pnpm dev
```

### 4. Verify Features

Navigate to:

- **Frontend**: http://localhost:3000
  - Check for yellow Pilot Mode banner at top
  - Go to `/admin/ciso` to view security summary
  - Go to `/admin/backup` to download bundles
  - Go to `/agent` and click "Start 5-Min Demo" button

- **Backend**: http://localhost:4000
  - Test: `curl http://localhost:4000/api/ciso/summary`
  - Test: `curl http://localhost:4000/api/demo-overlay/script`
  - Test: `curl http://localhost:4000/api/rollback/pilot/status`

## Pilot Mode Behavior

When `PILOT_MODE=1`:

✅ **Allowed:**
- Read operations
- Credential issuance
- Credential verification
- Status checks
- Demo scripts

❌ **Blocked:**
- Administrative data cleanup (`/api/agent/admin/dedupe`)
- MCP configuration imports (`/api/agent/mcp-admin/import`)
- Status assignment changes (`/api/status-admin/*/assign`)
- Other destructive operations

Returns `423 Locked` with error message:
```json
{
  "error": "pilot_mode_locked",
  "message": "This operation is disabled in Pilot Mode",
  "pilotMode": true
}
```

## Demo Overlay Usage

1. Navigate to `/agent` page
2. Click **"Start 5-Min Demo"** button in bottom-left corner
3. Follow the timed steps:
   - 0:00 - Welcome & Overview
   - 0:30 - Credential Offer
   - 1:30 - Issue Credential
   - 2:30 - Selective Disclosure
   - 3:30 - Revocation
   - 4:30 - Audit Trail
4. Use pause/resume controls as needed
5. Demo auto-completes at 5:00

## CISO Explain Panel

Navigate to `/admin/ciso` to view:

- **Cryptography**: Algorithms, key rotation, signature methods
- **Identity**: OIDC4VCI, DID binding, NPI integration
- **Revocation**: StatusList2021, real-time updates, timeline
- **Audit**: Blockchain anchors, webhook signing, event logging
- **Privacy**: Selective disclosure, GDPR/HIPAA compliance
- **Operations**: Pilot mode status, SLO targets, uptime

## Backup & Export

### UI Method

1. Navigate to `/admin/backup`
2. Click **"Download MCP Bundle"** for tool configurations
3. Click **"Download Config Bundle"** for environment snapshot

### CLI Method

```bash
# Backend: Full database export
cd chai-vc-platform/backend
pnpm tsx scripts/export_bundle.ts

# Creates files in backend/exports/:
# - bundle_mcp_YYYY-MM-DD-HH-MM-SS.json
# - bundle_conf_YYYY-MM-DD-HH-MM-SS.json
# - bundle_mcp_latest.json (convenience link)
# - bundle_conf_latest.json (convenience link)
```

## Mobile Wallet Export (Stubs)

On credential detail pages (`/wallet/[credentialId]`):

- **Apple Wallet** button - Downloads JSON stub (`.pkpass` integration TBD)
- **Google Wallet** button - Downloads JSON stub (Google Wallet API integration TBD)

These are **placeholders** for future mobile wallet integrations.

## Go-Live Checklist

See `backend/docs/go-live-checklist.md` for comprehensive checklist covering:

- Security & environment
- Database & backups
- Access control
- Monitoring & alerting
- Infrastructure
- Compliance & audit
- Final testing
- Documentation
- Launch day procedures
- Post-launch review

## Rollback Procedure

If issues detected after disabling pilot mode:

```bash
# 1. Re-enable pilot mode via API
curl -X POST http://localhost:4000/api/rollback/pilot/enable

# 2. Restore from backup bundle (if needed)
# [Restore procedure TBD - depends on deployment strategy]

# 3. Document incident
```

## Troubleshooting

### Pilot Mode Banner Not Showing

Check `.env.local`:
```bash
NEXT_PUBLIC_PILOT_MODE=1
```

Restart Next.js dev server.

### CISO Page Shows Error

Verify backend is running and `AGENT_BASE` is correct:
```bash
curl $NEXT_PUBLIC_AGENT_BASE/../ciso/summary
```

### Demo Overlay Not Loading

Check browser console for fetch errors. Verify:
- Backend is running on expected port
- CORS is configured correctly
- `/api/demo-overlay/script` endpoint is accessible

### Export Bundle Script Fails

Ensure database connection is configured:
```bash
# Check DATABASE_URL
psql $DATABASE_URL -c "SELECT 1"

# Verify McpTool table exists
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"McpTool\""
```

## Security Notes

⚠️ **Production Deployment:**

1. **Protect admin endpoints**: Add authentication to `/api/rollback/*`
2. **Rotate secrets**: Change `JWT_SECRET`, `WEBHOOK_SECRET` before go-live
3. **Use HTTPS**: All URLs should use `https://` in production
4. **Secure database**: Ensure PostgreSQL uses strong passwords and is not publicly accessible
5. **Review CISO summary**: Verify all security controls are properly configured
6. **Disable demo routes**: Lock down `/demo*` routes in production

## Next Steps

1. Review go-live checklist: `backend/docs/go-live-checklist.md`
2. Test all Round 15 features in staging
3. Schedule stakeholder demo using 5-minute overlay
4. Review CISO summary with security team
5. Plan backup schedule (recommend hourly)
6. Set pilot mode disable date
7. Prepare rollback procedure

---

**Round 15 Complete** ✅

For questions or issues, refer to:
- `backend/docs/go-live-checklist.md`
- Frontend: `v0-vital-cv-frontend-mvp/README.md`
- Backend: `chai-vc-platform/backend/README.md`

