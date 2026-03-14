# Webhook Event Taxonomy

**Version:** 1.0.0  
**Status:** Stable  

---

## Overview

VitalCV fires signed webhook events to your endpoint when clinician trust state changes. Every event is HMAC-SHA256 signed with your `WIDGET_WEBHOOK_SECRET`.

---

## Signature Verification

Every request includes:
```
X-VitalCV-Signature: sha256=<hex>
X-VitalCV-Event: <event_type>
X-VitalCV-Delivery: <uuid>
```

Verify:
```typescript
import crypto from 'crypto';

function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = 'sha256=' + 
    crypto.createHmac('sha256', secret).update(body).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected), 
    Buffer.from(signature)
  );
}
```

---

## Event Types

### `candidate.shared`

Fired when a clinician submits their NPI to a verification widget. The earliest signal — fired before verification completes.

```json
{
  "id": "019ced42-e541-7d81-b933-753ffa1f6021",
  "event": "candidate.shared",
  "timestamp": "2026-03-14T09:47:00Z",
  "npi": "1234567890",
  "employer": {
    "clientId": "org_abc123",
    "jobId": "job_456",
    "atsType": "greenhouse"
  },
  "candidate": {
    "npi": "1234567890",
    "trustBand": "UNKNOWN",
    "readinessScore": 0,
    "activeCredentials": 0
  }
}
```

**Use case:** Create a placeholder record in your ATS before verification completes.

---

### `passport.verified`

Fired when credential verification completes and the trust band is established.

```json
{
  "id": "019ced42-e541-7d81-b933-753ffa1f6022",
  "event": "passport.verified",
  "timestamp": "2026-03-14T09:47:02Z",
  "npi": "1234567890",
  "employer": {
    "clientId": "org_abc123",
    "jobId": "job_456",
    "atsType": "greenhouse"
  },
  "candidate": {
    "npi": "1234567890",
    "trustBand": "GREEN",
    "readinessScore": 87,
    "activeCredentials": 4
  },
  "verification": {
    "credentialsVerified": ["NPIEnrollment", "StateLicense", "OIGClear", "BoardCertification"],
    "pasScore": 87,
    "pasBand": "A",
    "signature": "sha256=a3f8d2..."
  }
}
```

**Use case:** Update candidate status in ATS, trigger recruiter notification, create decision capsule.

---

### `trust_state.ready`

Fired when a full trust state computation is available for the NPI. Includes the methodology and gap summary.

```json
{
  "id": "019ced42-e541-7d81-b933-753ffa1f6023",
  "event": "trust_state.ready",
  "timestamp": "2026-03-14T09:47:03Z",
  "npi": "1234567890",
  "employer": {
    "clientId": "org_abc123",
    "jobId": "job_456"
  },
  "candidate": {
    "npi": "1234567890",
    "trustBand": "GREEN",
    "readinessScore": 87,
    "activeCredentials": 4
  },
  "trustState": {
    "readiness_level": "L3",
    "readiness_status": "Credentialing Complete",
    "methodology": "243.1",
    "computedAt": "2026-03-14T09:47:03Z",
    "gap_summary": []
  }
}
```

**Use case:** Feed into downstream AI systems, update dashboards, trigger compliance recording.

---

## Event Sequence

A typical widget submission fires events in this order:

```
1. candidate.shared      ← NPI received, verification starting
2. passport.verified     ← PSV complete, trust band established  
3. trust_state.ready     ← Full trust state with methodology + gaps
```

All three fire within ~1 second on a cache-warm NPI.

---

## Retry Policy

Failed webhook deliveries (non-2xx or timeout) are retried with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |

After 5 failures, the delivery is marked failed and logged. No further retries.

---

## Webhook Registration

Webhooks are configured per-employer via environment variables (pilot) or the `/billing` dashboard (GA):

```bash
WIDGET_WEBHOOK_SECRET=<random-32-byte-hex>
WIDGET_ATS_WEBHOOK_URL=https://your-ats.com/vitalcv/webhook
```

Multi-employer routing (per-client webhook URLs) is on the roadmap for v1.1.
