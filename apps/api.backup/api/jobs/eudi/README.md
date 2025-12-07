# EUDI Trust List Nightly Refresh Scheduler

## Overview

The EUDI trust list refresh scheduler runs automatically to keep the trust list up-to-date. It fetches the latest trust list from the pinned endpoint, verifies the signature, and updates the cache.

## Configuration

Set environment variables:

```bash
EUDI_TRUST_LIST_URL=https://eudi.ec.europa.eu/trust-list
EUDI_TRUST_LIST_PUBLIC_KEY=<public-key-pem>
EUDI_TRUST_LIST_REFRESH_CRON=0 2 * * *  # Default: 2:00 AM UTC daily
```

## Running the Scheduler

### As Standalone Process

```bash
# Build first
npm run build

# Run scheduler
node dist/jobs/eudi/scheduler.js
```

### Programmatically

```typescript
import { startTrustListScheduler, stopTrustListScheduler } from './jobs/eudi/scheduler';

// Start scheduler
startTrustListScheduler();

// Stop scheduler (graceful shutdown)
stopTrustListScheduler();
```

### Manual Refresh

```typescript
import { runTrustListRefreshNow } from './jobs/eudi/scheduler';

// Trigger immediate refresh
await runTrustListRefreshNow();
```

## Production Deployment

### Using PM2

```bash
pm2 start dist/jobs/eudi/scheduler.js --name eudi-trust-list-scheduler
pm2 save
```

### Using systemd

Create `/etc/systemd/system/eudi-trust-list-scheduler.service`:

```ini
[Unit]
Description=EUDI Trust List Refresh Scheduler
After=network.target

[Service]
Type=simple
User=node
WorkingDirectory=/path/to/chai-vc-platform
Environment="EUDI_TRUST_LIST_URL=https://eudi.ec.europa.eu/trust-list"
Environment="EUDI_TRUST_LIST_PUBLIC_KEY=<public-key>"
ExecStart=/usr/bin/node dist/jobs/eudi/scheduler.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl enable eudi-trust-list-scheduler
sudo systemctl start eudi-trust-list-scheduler
```

### Using Cron

Add to crontab:

```bash
0 2 * * * cd /path/to/chai-vc-platform && node dist/jobs/eudi/trust-list-refresh.js >> /var/log/eudi-refresh.log 2>&1
```

## Monitoring

Check scheduler status:

```bash
# Check if scheduler is running
ps aux | grep scheduler

# View logs
tail -f /var/log/eudi-refresh.log

# Check trust list status via API
curl http://localhost:4000/eu/trust-list/status
```

## Troubleshooting

### Scheduler not running

1. Check environment variables are set
2. Verify trust list URL is accessible
3. Check public key is valid
4. Review logs for errors

### Trust list refresh failing

1. Verify signature verification is working
2. Check pinned hostname matches
3. Ensure trust list is not stale (>7 days)
4. Check network connectivity

## Testing

Test the scheduler manually:

```bash
# Run refresh job directly
node dist/jobs/eudi/trust-list-refresh.js

# Test scheduler (will schedule next run)
node dist/jobs/eudi/scheduler.js
```

