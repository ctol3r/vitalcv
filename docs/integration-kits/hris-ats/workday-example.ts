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
  clinician: {
    authority_state: {
      status: 'GREEN' | 'YELLOW' | 'RED';
      score: number;
      band: 'A' | 'B' | 'C';
    };
  };
}

const VITALCV_WEBHOOK_SECRET = process.env.VITALCV_WEBHOOK_SECRET ?? '';
const WORKDAY_TENANT = process.env.WORKDAY_TENANT ?? '';
const WORKDAY_CLIENT_ID = process.env.WORKDAY_CLIENT_ID ?? '';
const WORKDAY_SECRET = process.env.WORKDAY_SECRET ?? '';

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

async function lookupWorkdayWorkerId(
  submissionId: string,
): Promise<string | null> {
  return process.env.WORKDAY_WORKER_ID ?? null;
}

async function getWorkdayAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
  });

  const response = await fetch(`https://api.workday.com/${encodeURIComponent(WORKDAY_TENANT)}/oauth2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${WORKDAY_CLIENT_ID}:${WORKDAY_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(8_000),
  });

  const token = await response.json() as { access_token: string };
  return token.access_token;
}

async function updateWorkdayWorkerNote(
  workerId: string,
  note: string,
): Promise<void> {
  const accessToken = await getWorkdayAccessToken();

  await fetch(
    `https://api.workday.com/${encodeURIComponent(WORKDAY_TENANT)}/workers/${encodeURIComponent(workerId)}/notes`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ note }),
      signal: AbortSignal.timeout(8_000),
    },
  );
}

export async function handleWorkdayWebhook(
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
  const workerId = await lookupWorkdayWorkerId(envelope.payload.submission_id);
  if (!workerId) {
    return;
  }

  const note =
    `VitalCV passport verified: ${envelope.payload.clinician.authority_state.status} `
    + `(score ${envelope.payload.clinician.authority_state.score}, `
    + `band ${envelope.payload.clinician.authority_state.band}).`;

  await updateWorkdayWorkerNote(workerId, note);
}
