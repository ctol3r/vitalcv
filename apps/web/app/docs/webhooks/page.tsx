import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Webhooks | VitalCV Docs',
  description: 'Automated webhook events for credential lifecycle changes.',
};

const EVENTS = [
  {
    type: 'credential.issued',
    desc: 'A new credential was issued to a clinician.',
    payload: '{ credentialId, npi, type, issuerId, issuedAt }',
    severity: 'info',
  },
  {
    type: 'credential.verified',
    desc: 'A credential was successfully verified by a verifier.',
    payload: '{ credentialId, npi, verifierId, trustBand, verifiedAt }',
    severity: 'info',
  },
  {
    type: 'credential.revoked',
    desc: 'A credential was revoked. Cascade impact included.',
    payload: '{ credentialId, npi, reason, revokedAt, cascadeImpact: { affected, atRisk } }',
    severity: 'critical',
  },
  {
    type: 'trust.alert',
    desc: 'A trust alert was emitted (issuer degradation, anomaly, expiry warning).',
    payload: '{ alertId, severity, title, subject, recommendedAction, createdAt }',
    severity: 'warning',
  },
  {
    type: 'issuer.health_changed',
    desc: 'An issuer trust score changed or HAIP compliance status changed.',
    payload: '{ issuerId, did, previousScore, newScore, haipCompliant }',
    severity: 'warning',
  },
  {
    type: 'federation.sync',
    desc: 'A federated network completed a trust chain sync.',
    payload: '{ networkId, entityId, trustChainLength, syncedAt }',
    severity: 'info',
  },
  {
    type: 'audit.anomaly_detected',
    desc: 'The audit baseline detected a statistical anomaly in event patterns.',
    payload: '{ eventType, zScore, windowMs, detectedAt }',
    severity: 'critical',
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  info: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const SUBSCRIBE_EXAMPLE = `// Register a webhook endpoint
const response = await fetch('https://api.vitalcv.com/v1/webhooks', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer <api_key>',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://your-app.com/webhooks/vitalcv',
    events: ['credential.revoked', 'trust.alert'],
    secret: 'whsec_your_signing_secret',
  }),
});`;

const VERIFY_EXAMPLE = `import { createHmac } from 'crypto';

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return \`sha256=\${expected}\` === signature;
}

// In your webhook handler:
app.post('/webhooks/vitalcv', (req, res) => {
  const sig = req.headers['x-vitalcv-signature'];
  const valid = verifyWebhookSignature(
    JSON.stringify(req.body),
    sig as string,
    process.env.WEBHOOK_SECRET!
  );
  if (!valid) return res.status(401).send('Invalid signature');
  
  const { type, payload } = req.body;
  // Handle event...
  res.status(200).send('ok');
});`;

export default function WebhooksPage() {
  return (
    <div className="space-y-16 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-sky-400 mb-3">Webhooks</p>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Event Webhooks</h1>
        <p className="text-zinc-400 leading-relaxed">
          VitalCV delivers immediate webhook events for all credential lifecycle changes.
          Events are signed with HMAC-SHA256, delivered with at-least-once semantics,
          and retried with exponential backoff for up to 24 hours.
        </p>
      </div>

      {/* Subscribe */}
      <div id="subscribe" className="space-y-4">
        <h2 className="text-xl font-semibold">Subscribing</h2>
        <div className="rounded-lg border border-white/5 bg-black/60 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
            </div>
            <span className="text-xs font-mono text-zinc-600">register-webhook.ts</span>
          </div>
          <pre className="px-5 py-4 text-sm font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            <code>{SUBSCRIBE_EXAMPLE}</code>
          </pre>
        </div>
        <p className="text-sm text-zinc-500">
          You can also manage webhooks in the <Link href="/developers" className="text-sky-400 hover:underline">Developer Portal</Link>.
        </p>
      </div>

      {/* Signature verification */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Signature Verification</h2>
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          Always verify webhook signatures before processing events. Unverified events should be rejected with HTTP 401.
        </div>
        <div className="rounded-lg border border-white/5 bg-black/60 overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <span className="text-xs font-mono text-zinc-600">webhook-handler.ts</span>
          </div>
          <pre className="px-5 py-4 text-sm font-mono text-zinc-300 overflow-x-auto leading-relaxed">
            <code>{VERIFY_EXAMPLE}</code>
          </pre>
        </div>
      </div>

      {/* Event catalog */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Event Catalog</h2>
        <div className="space-y-3">
          {EVENTS.map((ev) => (
            <div key={ev.type} className="rounded-xl border border-white/5 bg-white/2 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <code className="text-sm font-mono text-zinc-200">{ev.type}</code>
                <span className={`ml-auto text-xs font-mono px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[ev.severity]}`}>
                  {ev.severity}
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm text-zinc-400">{ev.desc}</p>
                <div>
                  <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 mb-1">Payload</p>
                  <code className="block text-xs bg-black/30 rounded px-3 py-2 text-emerald-300 font-mono">{ev.payload}</code>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-6 space-y-3">
        <h2 className="font-semibold">Delivery Guarantees</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• <strong className="text-zinc-200">At-least-once delivery</strong> — events may be delivered more than once; use <code className="text-violet-300">id</code> for deduplication</li>
          <li>• <strong className="text-zinc-200">Retry policy</strong> — exponential backoff, max 10 attempts over 24 hours</li>
          <li>• <strong className="text-zinc-200">Timeout</strong> — your endpoint must respond within 10 seconds</li>
          <li>• <strong className="text-zinc-200">Ordering</strong> — not guaranteed; events may arrive out of order</li>
        </ul>
      </div>

      {/* Footer nav */}
      <div className="flex justify-between text-sm">
        <Link href="/docs/sdk" className="text-zinc-400 hover:text-white transition-colors">← SDKs</Link>
        <Link href="/developers" className="text-sky-400 hover:text-sky-300 transition-colors">Developer Portal →</Link>
      </div>
    </div>
  );
}
