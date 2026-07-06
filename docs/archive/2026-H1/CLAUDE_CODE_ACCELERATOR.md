# Claude Code Accelerator Prompts

To hit the end-of-day deadline, we are parallelizing the execution. While the background OpenClaw sub-agent grinds through the backend infrastructure (Waves 3, 4, 6, 11), use these exact commands to spin up **Claude Code** instances in parallel terminal windows to tackle isolated frontend, mobile, and edge systems.

### Terminal 1: Mobile Wallet Track (Wave 7)
*Context: Isolated strictly to `apps/mobile` and edge APIs. Safe to run in parallel.*
```bash
cd ~/vitalcv
claude -p "Read CLAUDE.md and VITALCV-BILLION-DOLLAR-WAVE-BUNDLE.md. You are responsible for Wave 7: Mobile Wallet Integration. 
1. Create and checkout branch: feature/mobile-wallet-integration
2. Wire WalletSyncService to production API (GET /api/passport/npi/:npi).
3. Implement push notifications for credential expiry.
4. Build the QR presentation flow outputting a VP JWT.
5. Create integration tests for the mobile wallet flow.
Do not touch core backend API routes outside of mobile endpoints."
```

### Terminal 2: Embed SDK & ATS Integration Track (Waves 5 & 10)
*Context: Isolated strictly to `packages/embed-sdk` and `services/integrations`. Safe to run in parallel.*
```bash
cd ~/vitalcv
claude -p "Read CLAUDE.md and VITALCV-BILLION-DOLLAR-WAVE-BUNDLE.md. You are responsible for Wave 5 (Apply Embed SDK) and Wave 10 (ATS Integration Scaffolding). 
1. Create and checkout branch: feature/apply-embed-and-ats
2. Define canonical ApplyPayload in packages/embed-sdk.
3. Build the embeddable widget cross-origin logic.
4. Scaffold the ATSIntegration interface and Workday adapter stub in backend/src/services/integrations/workday/.
5. Build the webhook receiver.
Ensure every mutating endpoint writes an AuditEvent."
```

### Terminal 3: Dashboards & Frontend Workflows (Waves 8 & 9)
*Context: UI heavy, minimal backend collision.*
```bash
cd ~/vitalcv
claude -p "Read CLAUDE.md and VITALCV-BILLION-DOLLAR-WAVE-BUNDLE.md. You are responsible for Wave 8 (Resident Wedge) and Wave 9 (Employer Capacity Dashboard). 
1. Create and checkout branch: feature/dashboards-and-wedges
2. Build the GME-aware onboarding variant detecting PGY level.
3. Build the capacity metrics API (SEPQ, ISV, Pipeline).
4. Build the Capacity Dashboard UI under /employers/capacity.
Ensure 0 errors in 'pnpm --filter web build' when complete."
```

### Review & Merge Instructions for Claude
When asking Claude Code to review its work before finishing, use:
```bash
claude -p "Run full typescript checks (pnpm tsc --noEmit), linting, and build verification. Fix any errors. Once clean, ensure you haven't written any Prisma migrations. Report ready for merge."
```
