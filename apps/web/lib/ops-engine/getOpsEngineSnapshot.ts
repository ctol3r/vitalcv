/**
 * getOpsEngineSnapshot — assembles a REAL Operations Engine snapshot for the
 * signed-in operator's organization, server-side.
 *
 * Architecture reality: apps/web is a thin client. The roster (employer
 * applications, credentialing org-contexts, verifier worklist), the readiness
 * engine, and the append-only audit ledger all live in the backend service
 * (apps/api/backend). getBackendBase() resolves to that backend
 * (https://api.vitalcv.com in production, localhost:4000 in dev). This loader
 * calls the backend; it NEVER fabricates roster data.
 *
 * Backend auth: endpoints under /api/employer/** require the operator's Clerk
 * identity, forwarded as x-clerk-user-id via buildMarketplaceHeaders(session).
 * The audit ledger (/api/audit/events) is public.
 *
 * Honest degradation:
 *   - No backend base resolved          → status 'unavailable'
 *   - Backend unreachable               → status 'unavailable'
 *   - Reachable but no roster records   → status 'empty'
 *   - Real records present              → status 'live'
 */

import 'server-only';
import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';
import type { OpsEvent, OpsSnapshot, OpsWorkspace } from './contract';
import { mapEmployerDashboard } from './adapters';

export interface OpsSnapshotRequest {
  userId?: string | null;
  orgId?: string | null;
  /** Clerk session (Awaited<ReturnType<typeof auth>>) for backend auth forwarding. */
  session?: any;
}

/** Map one backend AuditEntry into the UI ledger-event shape. Pure. */
function mapAuditEntryToOpsEvent(entry: any, idx: number): OpsEvent {
  const categories: string[] = Array.isArray(entry?.category) ? entry.category : [];
  return {
    id: String(entry?.eventId ?? `e${idx}`),
    seq: idx + 1,
    ts: entry?.time ? Date.parse(entry.time) : 0,
    type: (categories[0] ?? 'EVENT').toLowerCase(),
    actor: entry?.actor ?? null,
    subjectId: entry?.resource ?? null,
    subject: entry?.resource ?? null,
    group: null,
    detail: [entry?.severity, categories.join('+')].filter(Boolean).join(' · '),
    system: !entry?.actor,
  };
}

/** Audit ledger is public — no auth required. */
async function fetchLedger(base: string): Promise<OpsEvent[]> {
  const res = await fetch(`${base}/api/audit/events?limit=200`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ledger ${res.status}`);
  const data = await res.json();
  const events: any[] = Array.isArray(data?.events) ? data.events : [];
  return events.map(mapAuditEntryToOpsEvent);
}

/**
 * Employer / credentialing / verifier roster adapters → OpsWorkspace[].
 *
 * Endpoints + exact shapes are confirmed (apps/api/backend):
 *   employer      → GET /api/employer/applications/dashboard  (auth: x-clerk-user-id)
 *   credentialing → org-context list (auth)
 *   verifier      → worklist (auth)
 * They render into the full engine only once live-mode hydration lands, so
 * they are built + verified end-to-end in that step rather than shipped unused
 * here. Until then the roster is honestly empty.
 */
async function fetchRoster(
  base: string,
  ledger: OpsEvent[],
  req: OpsSnapshotRequest,
): Promise<OpsWorkspace[]> {
  if (!req.session?.userId) return [];
  const workspaces: OpsWorkspace[] = [];

  // Employer hiring pipeline (Application × Opportunity), scoped to the
  // operator's org via forwarded Clerk identity.
  try {
    const res = await fetch(`${base}/api/employer/applications/dashboard`, {
      headers: await buildMarketplaceHeaders(req.session),
      cache: 'no-store',
    });
    if (res.ok) {
      const dashboard = await res.json();
      const ws = mapEmployerDashboard(dashboard, ledger, req.orgId ?? null);
      if (ws) workspaces.push(ws);
    }
  } catch {
    // Source unavailable — fall through; other sources / honest empty still apply.
  }

  return workspaces;
}

function unavailable(reason: string, req: OpsSnapshotRequest): OpsSnapshot {
  return { status: 'unavailable', reason, generatedAt: Date.now(), orgId: req.orgId ?? null, workspaces: [] };
}

export async function getOpsEngineSnapshot(req: OpsSnapshotRequest = {}): Promise<OpsSnapshot> {
  const base = getBackendBase();
  if (!base) {
    return unavailable(
      'No backend base resolved. The Operations Engine reads the live roster and ledger from the VitalCV backend service.',
      req,
    );
  }

  let events: OpsEvent[] = [];
  try {
    events = await fetchLedger(base);
  } catch (err) {
    return unavailable(
      `Backend unreachable at ${base} (${err instanceof Error ? err.message : 'error'}).`,
      req,
    );
  }

  const workspaces = await fetchRoster(base, events, req);

  if (workspaces.length === 0) {
    return {
      status: 'empty',
      reason: `Connected to the live backend (${base}). Ledger holds ${events.length} event${events.length === 1 ? '' : 's'}; no provider roster is available for this operator/organization yet. The live roster view renders once roster hydration is enabled and the org has records.`,
      generatedAt: Date.now(),
      orgId: req.orgId ?? null,
      workspaces: [],
    };
  }

  // Attach the shared ledger to each workspace (per-workspace filtering happens
  // in the roster adapter once implemented).
  const withEvents = workspaces.map((w) => ({ ...w, events: w.events.length ? w.events : events }));
  return { status: 'live', generatedAt: Date.now(), orgId: req.orgId ?? null, workspaces: withEvents };
}
