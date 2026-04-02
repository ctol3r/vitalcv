import React from 'react';
import type { Metadata } from 'next';
import { buildWebhookSubscribeExample } from '@/lib/developers/public-api-reference';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Webhooks | VitalCV Docs',
  description: 'Current webhook registration routes and event contract.',
};

const EVENTS = [
  {
    type: 'credential_verified',
    desc: 'A credential verification completed for a clinician.',
    payload: '{ npi, trustBand, verifiedAt }',
    severity: 'info',
  },
  {
    type: 'credential_revoked',
    desc: 'A credential was revoked. Downstream reviewers should refresh their view.',
    payload: '{ credentialId, npi, reason, revokedAt }',
    severity: 'critical',
  },
  {
    type: 'decision_created',
    desc: 'A reviewer created a new decision event from the current workflow.',
    payload: '{ entityId, decisionType, createdAt }',
    severity: 'info',
  },
  {
    type: 'trust_state_changed',
    desc: 'A clinician readiness or trust-state snapshot changed.',
    payload: '{ npi, previous, next, observedAt }',
    severity: 'warning',
  },
];

const SEVERITY_STYLES: Record<string, string> = {
  info: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
};

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
  const subscribeExample = buildWebhookSubscribeExample();

  return (
    <div className="space-y-16 max-w-4xl">
      {/* Header */}
      <div>
        <p className="text-xs font-mono uppercase tracking-widest text-sky-400 mb-3">Webhooks</p>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Event Webhooks</h1>
        <p className="text-zinc-400 leading-relaxed">
          The current backend exposes webhook registration under the network gateway routes.
          Use the event names below when wiring subscriptions against the current API host.
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
            <code>{subscribeExample}</code>
          </pre>
        </div>
        <p className="text-sm text-zinc-500">
          You can also preview webhook payloads in the <Link href="/developers" className="text-sky-400 hover:underline">Developer Portal</Link>.
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
          <li>• <strong className="text-zinc-200">Preview contract</strong> — event names here match the current backend registration route.</li>
          <li>• <strong className="text-zinc-200">Signing</strong> — verify the HMAC signature before processing any payload.</li>
          <li>• <strong className="text-zinc-200">Ordering</strong> — do not assume event ordering when multiple source checks are in flight.</li>
          <li>• <strong className="text-zinc-200">Retries</strong> — confirm delivery behavior against the API host you are integrating with.</li>
        </ul>
      </div>

      {/* Footer nav */}
      <div className="flex justify-between text-sm">
        <Link href="/docs/sdk" className="text-zinc-400 hover:text-foreground transition-colors">← SDKs</Link>
        <Link href="/developers" className="text-sky-400 hover:text-sky-300 transition-colors">Developer Portal →</Link>
      </div>
    </div>
  );
}
