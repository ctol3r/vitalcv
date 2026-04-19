/**
 * /employer/developer — Developer & API integration surface.
 *
 * Hospital IT and integration partners mint API keys, audit webhook
 * deliveries, and (in later waves) configure signing secrets here. This
 * route is a thin server shell — all interactive logic lives in the two
 * client cards it composes.
 *
 * Seed data is inlined until the server routes (GET /api/keys,
 * GET /api/webhooks/deliveries) land; replace the fixtures with live
 * fetches at that point.
 */

import React from 'react';

import KeyManagerCard, {
  type ApiKey,
} from '@/components/developer/KeyManagerCard';
import WebhookLogTable, {
  type WebhookDelivery,
} from '@/components/developer/WebhookLogTable';

void React;

const SEED_KEYS: ApiKey[] = [
  {
    id: 'key_epic_bridge',
    label: 'Epic HRIS bridge',
    prefix: 'vcv_live_a91f3c',
    createdAt: '2026-02-12T14:03:00.000Z',
    lastUsedAt: '2026-04-18T09:21:00.000Z',
    revokedAt: null,
  },
  {
    id: 'key_workday_sync',
    label: 'Workday nightly sync',
    prefix: 'vcv_live_7dd210',
    createdAt: '2025-11-04T18:41:00.000Z',
    lastUsedAt: '2026-04-18T11:02:00.000Z',
    revokedAt: null,
  },
  {
    id: 'key_legacy_import',
    label: 'Legacy CSV importer',
    prefix: 'vcv_live_4a0b88',
    createdAt: '2025-07-22T02:10:00.000Z',
    lastUsedAt: '2025-10-30T22:18:00.000Z',
    revokedAt: '2025-11-05T16:00:00.000Z',
  },
];

const SEED_DELIVERIES: WebhookDelivery[] = [
  {
    id: 'whd_01',
    timestamp: '2026-04-18T11:02:14.000Z',
    endpoint: 'https://hooks.example-health.org/vcv',
    event: 'credential.verified',
    httpStatus: 200,
    latencyMs: 142,
    state: 'delivered',
    attempt: 1,
  },
  {
    id: 'whd_02',
    timestamp: '2026-04-18T10:58:01.000Z',
    endpoint: 'https://hooks.example-health.org/vcv',
    event: 'privilege.granted',
    httpStatus: 200,
    latencyMs: 188,
    state: 'delivered',
    attempt: 1,
  },
  {
    id: 'whd_03',
    timestamp: '2026-04-18T10:41:55.000Z',
    endpoint: 'https://hooks.staging.example-health.org/vcv',
    event: 'application.submitted',
    httpStatus: 502,
    latencyMs: 3010,
    state: 'retrying',
    attempt: 2,
  },
  {
    id: 'whd_04',
    timestamp: '2026-04-18T10:39:00.000Z',
    endpoint: 'https://hooks.staging.example-health.org/vcv',
    event: 'application.submitted',
    httpStatus: 502,
    latencyMs: 2988,
    state: 'failed',
    attempt: 1,
  },
  {
    id: 'whd_05',
    timestamp: '2026-04-18T09:21:46.000Z',
    endpoint: 'https://hooks.example-health.org/vcv',
    event: 'warranty.issued',
    httpStatus: 201,
    latencyMs: 205,
    state: 'delivered',
    attempt: 1,
  },
  {
    id: 'whd_06',
    timestamp: '2026-04-18T08:14:12.000Z',
    endpoint: 'https://hooks.example-health.org/vcv',
    event: 'attestation.expiring',
    httpStatus: 204,
    latencyMs: 98,
    state: 'delivered',
    attempt: 1,
  },
  {
    id: 'whd_07',
    timestamp: '2026-04-18T07:02:33.000Z',
    endpoint: 'https://hooks.example-health.org/vcv',
    event: 'trust.signal.updated',
    httpStatus: null,
    latencyMs: null,
    state: 'pending',
    attempt: 1,
  },
];

export default function EmployerDeveloperPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-2 border-b border-white/6 pb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
            Employer · Developer
          </p>
          <h1 className="text-2xl font-semibold leading-tight text-foreground/95">
            Developer &amp; API integration
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/65">
            Mint API keys for HRIS, credentialing, and warranty pipelines, and
            audit the webhook deliveries VitalCV has sent to your endpoints.
          </p>
        </header>

        <KeyManagerCard initialKeys={SEED_KEYS} />
        <WebhookLogTable deliveries={SEED_DELIVERIES} />
      </div>
    </main>
  );
}
