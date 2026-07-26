/**
 * Server-side entity-preview resolvers.
 *
 * Each resolver reuses the SAME authorized data path as the entity's full
 * surface (so authorization is enforced once, in the backend, not re-implemented
 * here) and returns a small preview or null. Null means "no preview" — absent OR
 * unauthorized, indistinguishably — so a preview can never confirm the existence
 * of an entity the viewer may not see. The route maps null to a uniform 404.
 *
 * Only `opportunity` is wired today: it has a real by-id backend endpoint. The
 * employer/evidence entity-id model is NPI-projected rather than opaque-id, so
 * their resolvers land in a later pass; until then their links simply show no
 * preview (the link itself still works).
 */

import type { auth } from '@clerk/nextjs/server';

import { getBackendBase } from '@/lib/api';
import { buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy';

import type { EntityPreview, PreviewableType } from './types';

type Session = Awaited<ReturnType<typeof auth>>;

function str(o: Record<string, unknown>, key: string): string | null {
  return typeof o[key] === 'string' && (o[key] as string).length > 0 ? (o[key] as string) : null;
}

async function resolveOpportunityPreview(id: string, session: Session): Promise<EntityPreview | null> {
  let res: Response;
  try {
    res = await fetch(`${getBackendBase()}/api/opportunities/${encodeURIComponent(id)}`, {
      cache: 'no-store',
      headers: await buildMarketplaceHeaders(session, { 'Content-Type': 'application/json' }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null; // 404/403/5xx → no preview, uniformly

  const body = (await res.json().catch(() => null)) as { opportunity?: unknown } | null;
  const raw = (body?.opportunity ?? body) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || typeof raw.title !== 'string') {
    return null;
  }

  const location = raw.remote === true ? 'Remote' : (str(raw, 'state') ?? 'Location not listed');
  const fields: EntityPreview['fields'] = [
    { label: 'Specialty', value: str(raw, 'specialty') ?? 'Not listed' },
    { label: 'Location', value: location },
    ...(str(raw, 'payRange') ? [{ label: 'Compensation', value: str(raw, 'payRange')! }] : []),
  ];

  return {
    type: 'opportunity',
    id,
    title: raw.title as string,
    subtitle: str(raw, 'organizationName') ?? 'Organization not listed',
    state: str(raw, 'hiringType') ?? str(raw, 'status') ?? undefined,
    fields,
  };
}

const RESOLVERS: Partial<Record<PreviewableType, (id: string, session: Session) => Promise<EntityPreview | null>>> = {
  opportunity: resolveOpportunityPreview,
};

export async function resolveEntityPreview(
  type: PreviewableType,
  id: string,
  session: Session,
): Promise<EntityPreview | null> {
  const resolver = RESOLVERS[type];
  if (!resolver) return null;
  return resolver(id, session);
}
