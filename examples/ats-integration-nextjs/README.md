# ATS Integration Example — VitalCV + Next.js

A minimal Next.js app demonstrating how to integrate VitalCV credential verification into an Applicant Tracking System (ATS).

## Features

- **Webhook verification** — Verify VitalCV webhook signatures using `@vitalcv/verifier-sdk`
- **CHAPI payload ingestion** — Accept CHAPI store payloads from clinician wallets
- **ATS record ingestion** — Map verified credentials to ATS candidate records

## Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Environment Variables

```
VITALCV_API_URL=https://api.vitalcv.com
VITALCV_API_KEY=your_api_key
VITALCV_WEBHOOK_SECRET=your_webhook_secret
```

## Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/webhook` | POST | VitalCV webhook receiver (signature-verified) |
| `/api/chapi` | POST | CHAPI store payload ingestion |
| `/api/candidates` | GET | List ATS candidate records |

## How It Works

1. **Webhook**: VitalCV sends credential events to `/api/webhook`. The route verifies the HMAC-SHA256 signature before processing.

2. **CHAPI**: Clinicians share credentials via their wallet. The wallet sends a CHAPI `VerifiablePresentation` to `/api/chapi`.

3. **ATS Records**: Verified credentials are mapped to candidate records in your ATS database.

## SDK Usage

```typescript
import { createVerifier, verifyWebhookSignature } from '@vitalcv/verifier-sdk';

// Verify webhook
const valid = verifyWebhookSignature(rawBody, signatureHeader, secret);

// Check trust band
const verifier = createVerifier({ baseUrl: process.env.VITALCV_API_URL! });
const trust = await verifier.getTrustBand(npi);
```
