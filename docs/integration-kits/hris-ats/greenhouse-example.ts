import { createHmac, timingSafeEqual } from 'node:crypto';

type WidgetEvent = 'candidate.shared' | 'passport.verified' | 'trust_state.ready';

interface WidgetWebhookEnvelope<TPayload> {
  schema: 'vitalcv.widget.event.v1';
  event: WidgetEvent;
  issued_at: string;
  payload: TPayload;
}

interface PassportVerifiedPayload {
  submission_id: string;
  client_id: string;
  clinician: {
    npi_prefix: string;
    authority_state: {
      status: 'GREEN' | 'YELLOW' | 'RED';
      score: number;
      band: 'A' | 'B' | 'C';
      as_of: string;
      credentials_verified: number;
    };
  };
}

const GREENHOUSE_API_KEY = process.env.GREENHOUSE_API_KEY ?? '';
const VITALCV_WEBHOOK_SECRET = process.env.VITALCV_WEBHOOK_SECRET ?? '';

function verifyVitalCVSignature(
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

async function lookupGreenhouseCandidateId(
  submissionId: string,
): Promise<string | null> {
  return process.env.GREENHOUSE_CANDIDATE_ID ?? null;
}

async function addGreenhouseNote(
  candidateId: string,
  note: string,
): Promise<void> {
  await fetch(
    `https://harvest.greenhouse.io/v1/candidates/${encodeURIComponent(candidateId)}/activity_feed/notes`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${GREENHOUSE_API_KEY}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body: note }),
      signal: AbortSignal.timeout(8_000),
    },
  );
}

export async function handleGreenhouseWebhook(
  rawBody: string,
  headers: Record<string, string | undefined>,
): Promise<void> {
  if (
    !verifyVitalCVSignature(
      rawBody,
      headers['x-vitalcv-signature'] ?? headers['X-VitalCV-Signature'],
      VITALCV_WEBHOOK_SECRET,
    )
  ) {
    throw new Error('Invalid VitalCV signature');
  }

  const eventName = headers['x-vitalcv-event'] ?? headers['X-VitalCV-Event'];
  if (eventName !== 'passport.verified') {
    return;
  }

  const envelope = JSON.parse(rawBody) as WidgetWebhookEnvelope<PassportVerifiedPayload>;
  const candidateId = await lookupGreenhouseCandidateId(envelope.payload.submission_id);
  if (!candidateId) {
    return;
  }

  const note =
    `VitalCV passport verified: ${envelope.payload.clinician.authority_state.status} `
    + `(score ${envelope.payload.clinician.authority_state.score}, `
    + `band ${envelope.payload.clinician.authority_state.band}).`;

  await addGreenhouseNote(candidateId, note);
}
