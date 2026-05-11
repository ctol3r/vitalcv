import { TrustStateConsole } from '@/components/TrustStateConsole';
import { ReplayTimeline } from '@/components/ReplayTimeline';
import { space } from '@/lib/design-tokens';

/**
 * /console — demo mount of the institutional trust state console.
 *
 * This is the design-doctrine reference page for the dashboard
 * refactor brief. Static sample data (no fetches, no fixtures from
 * a backend) — the components themselves are pure-render and accept
 * everything via props.
 *
 * Real consumers (post-merge of #312 / #313 / #318 / #319) will
 * pass real data fetched from /api/passport/[npi] + the SSE
 * ingest stream + /status-list/* + the AuditExport Prisma table.
 */
export default function ConsolePage() {
  const sampleEvents = [
    { eventId: 'evt-1', eventType: 'source_start',    observedAt: '2026-05-11T00:00:01Z', sourceId: 'nppes' },
    { eventId: 'evt-2', eventType: 'source_complete', observedAt: '2026-05-11T00:00:02Z', sourceId: 'nppes' },
    { eventId: 'evt-3', eventType: 'source_start',    observedAt: '2026-05-11T00:00:03Z', sourceId: 'oig' },
    { eventId: 'evt-4', eventType: 'source_complete', observedAt: '2026-05-11T00:00:04Z', sourceId: 'oig' },
    { eventId: 'evt-5', eventType: 'source_start',    observedAt: '2026-05-11T00:00:05Z', sourceId: 'pecos' },
    { eventId: 'evt-6', eventType: 'passport_ready',  observedAt: '2026-05-11T00:00:06Z', sourceId: null },
  ];

  return (
    <>
      <TrustStateConsole
        subject={{
          npi: '1346053246',
          displayName: 'Macie Miller',
          entityType: 'PA-C',
        }}
        identity={{ state: 'ok', detail: 'NPPES record matched' }}
        lineage={{
          state: 'ambiguous',
          digest: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
          eventCount: sampleEvents.length,
          comprehensive: false,
        }}
        manifest={{
          state: 'ambiguous',
          schema: 'vitalcv.manifest.v1',
          signed: false,
          kid: null,
        }}
        revocation={{ state: 'ok', revoked: false, historyCount: 0 }}
        jwks={{ state: 'ambiguous', status: 'not-configured' }}
        exports={{ state: 'unknown', count: 0, latestDigest: null }}
      />
      <div style={{ maxWidth: '960px', margin: '0 auto', padding: `0 ${space['5']} ${space['8']}` }}>
        <ReplayTimeline
          events={sampleEvents}
          digest="a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90"
          comprehensive={false}
        />
      </div>
    </>
  );
}
