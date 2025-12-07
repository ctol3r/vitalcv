# NCQA Monitoring Scheduler

Monthly sanctions and licensure monitoring scheduler for NCQA compliance.

## Task: B119B-NCQA-011

### Acceptance Criteria
- ✅ Cron runs every 30 days
- ✅ Proofs anchored to AuditScrapbook

## Usage

### Programmatic Usage

```typescript
import { getNCQAScheduler } from './ncqa-scheduler';

const scheduler = getNCQAScheduler();

// Run monitoring for a single provider
const proof = await scheduler.runMonitoringChecks('provider-1', '1234567890');

// Run monthly monitoring for all providers
const result = await scheduler.runMonthlyMonitoring();
```

### Cron Integration

Using `node-cron`:

```typescript
import cron from 'node-cron';
import { runNCQAMonitoringCron } from './ncqa-scheduler';

// Run every 30 days (at midnight on the 1st of every month)
cron.schedule('0 0 1 * *', async () => {
  await runNCQAMonitoringCron();
});
```

Or using a system cron:

```bash
# Add to crontab (runs on the 1st of every month at midnight)
0 0 1 * * cd /path/to/chai-vc-platform && npm run ncqa-monitoring
```

## Monitoring Checks

### Sanctions Checks
- **OIG (Office of Inspector General)**: Checks LEIE (List of Excluded Individuals/Entities)
- **SAM (System for Award Management)**: Checks federal exclusions

### Licensure Checks
- **State Licensing Boards**: Checks license status and expiration dates

## Proof Anchoring

All monitoring proofs are:
1. Hashed using SHA-256
2. Recorded in AuditScrapbook
3. Anchored on-chain via Polkadot service

## Alerts

The scheduler automatically detects and alerts on:
- Sanctioned providers (OIG or SAM exclusions)
- Expired licenses
- Suspended licenses
- Revoked licenses

## Configuration

Set environment variables:
- `SUBSTRATE_WS`: WebSocket endpoint for Polkadot connection (optional, falls back to mock)
- `OIG_API_URL`: OIG API endpoint (optional, uses mock if not set)
- `SAM_API_URL`: SAM API endpoint (optional, uses mock if not set)

