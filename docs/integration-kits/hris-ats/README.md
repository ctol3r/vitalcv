# HRIS / ATS Integration Kit

## Quick Start

1. Get an API key from `/billing`
2. Call `GET /api/readiness/:npi/clear-to-start?state=CA&profession=RN`
3. Subscribe to PSV webhooks via `POST /api/psv/enroll/:npi`

## TypeScript Client

```typescript
import { ReadinessClient } from '@vitalcv/sdk';
const client = new ReadinessClient('https://vitalcv.com');
const status = await client.getClearToStart({ npi: '1234567890', state: 'CA', profession: 'RN' });
// { clearToStart: true, daysEstimate: 3, report: { ... } }
```

## Webhook Events
- `psv.status_change` — provider credential status changed
- `psv.revocation` — credential revoked; remove from active pool
- `trust.contested` — NPI identity binding contested; hold hiring workflow

## Feature Flags Required
- `FEATURE_PSV_ADAPTERS=true`
- `FEATURE_READINESS_ENGINE=true`
