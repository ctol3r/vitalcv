# HRIS / ATS Integration Kit

VitalCV emits three widget webhook events that HRIS and ATS systems can consume after a clinician shares credential readiness through the widget.

## Webhook Envelope

Every delivery is JSON with this envelope:

```ts
interface WidgetWebhookEnvelope<TPayload> {
  schema: 'vitalcv.widget.event.v1';
  event: 'candidate.shared' | 'passport.verified' | 'trust_state.ready';
  issued_at: string;
  payload: TPayload;
}
```

Headers:

- `X-VitalCV-Event`: event name
- `X-VitalCV-Signature`: `sha256=<hex>`

## Event Table

| Event | When it fires | Payload highlights |
| --- | --- | --- |
| `candidate.shared` | A clinician submits consent with an NPI | `submission_id`, `client_id`, `clinician.npi_prefix` |
| `passport.verified` | PAS has been built | `clinician.authority_state.status`, `score`, `band`, `credentials_verified` |
| `trust_state.ready` | Sanitized trust state is available | `trust_state.readiness_level`, `trust_state.readiness_score`, `trust_state.facts`, `trust_state.gaps` |

## Signature Verification

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyVitalCVSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }

  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    'utf8',
  );
  const actual = Buffer.from(signatureHeader.slice('sha256='.length), 'utf8');

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
```

## Integration Pattern

1. Receive the raw webhook body and verify `X-VitalCV-Signature`.
2. Route only the events you need. Most ATS note-writing flows react to `passport.verified`.
3. Resolve the ATS-native candidate record from your own `submission_id` mapping.
4. Add a note or tag inside the ATS.

VitalCV does not emit your ATS-native candidate ID. Persist a local correlation from `submission_id` or your own apply-session identifier to the candidate record your ATS created.

## Per-ATS Setup

### Greenhouse

1. Create a Harvest API key with candidate read/write scopes.
2. Store `GREENHOUSE_API_KEY` in your integration runtime.
3. Handle `passport.verified` and add a candidate note or tag.
4. Reference: [greenhouse-example.ts](/Users/christoler/vitalcv-widget/docs/integration-kits/hris-ats/greenhouse-example.ts)

### Lever

1. Create a Lever API key with candidate note/tag permissions.
2. Store `LEVER_API_KEY`.
3. Handle `passport.verified` and append the PAS summary to the candidate.
4. Reference: [lever-example.ts](/Users/christoler/vitalcv-widget/docs/integration-kits/hris-ats/lever-example.ts)

### Workday

1. Register an OAuth client that can use `client_credentials`.
2. Store `WORKDAY_TENANT`, `WORKDAY_CLIENT_ID`, and `WORKDAY_SECRET`.
3. Exchange the token, then write a worker note when `passport.verified` arrives.
4. Reference: [workday-example.ts](/Users/christoler/vitalcv-widget/docs/integration-kits/hris-ats/workday-example.ts)

### iCIMS

1. Provision an iCIMS API user with note-write permissions.
2. Store `ICIMS_CUSTOMER_ID`, `ICIMS_USERNAME`, and `ICIMS_PASSWORD`.
3. Verify the webhook signature and write a note when the PAS is verified.
4. Reference: [icims-example.ts](/Users/christoler/vitalcv-widget/docs/integration-kits/hris-ats/icims-example.ts)
