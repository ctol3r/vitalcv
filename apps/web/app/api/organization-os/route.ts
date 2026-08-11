import { NextRequest, NextResponse } from 'next/server';
import {
  defaultReadinessTemplate,
  deriveMobilityOverview,
  detectGaps,
  generateIntelligence,
  projectEvidenceToGraph,
  projectOrganizations,
  projectReadiness,
  projectTimeline,
  propagateTrust,
} from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';
import { aggregateOrganization, buildProviderSnapshot, type ProviderSnapshot } from '@/lib/organization/aggregate';

export const runtime = 'nodejs';

const MAX_PROVIDERS = 50;

async function providerSnapshot(entityId: string): Promise<ProviderSnapshot> {
  const passport = await resolvePassportRuntimePassport(entityId);
  // ADR 0006: public, NPI-keyed — reduce to publicly-disclosable evidence BEFORE
  // projecting, so a non-public node never exists. See graph-routes-public-disclosure.test.ts.
  const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
  const graph = projectEvidenceToGraph(collection);
  const trust = propagateTrust(graph);
  const timeline = projectTimeline(collection, graph, trust);
  const mobility = deriveMobilityOverview(collection, trust);
  const organizations = projectOrganizations(collection, graph);
  const template = defaultReadinessTemplate();
  const readiness = projectReadiness(template, detectGaps(template, collection, trust), trust);
  const intelligence = generateIntelligence(collection, trust, timeline, mobility, organizations);
  return buildProviderSnapshot({ subjectKey: collection.subjectKey, evidence: collection, trust, timeline, mobility, readiness, intelligence });
}

/**
 * GET /api/organization-os?org=<key>&providers=id1,id2,... — Organization OS
 * (Wave 510): executive metrics, provider directory, and hiring pipeline aggregated
 * across the supplied provider roster. Read-only; the roster is caller-supplied
 * (never fabricated). Does not touch the pre-existing employer/workforce backend.
 */
export async function GET(req: NextRequest) {
  const organizationKey = req.nextUrl.searchParams.get('org')?.trim() || 'organization';
  const raw = req.nextUrl.searchParams.get('providers') ?? '';
  const ids = [...new Set(raw.split(',').map((s) => s.trim()).filter(Boolean))];

  if (ids.length === 0) {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Provide a comma-separated `providers` list.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const truncated = ids.length > MAX_PROVIDERS;
  const roster = ids.slice(0, MAX_PROVIDERS);

  try {
    const snapshots = await Promise.all(roster.map((id) => providerSnapshot(id)));
    const org = aggregateOrganization(organizationKey, snapshots);
    return NextResponse.json(
      { schema: 'vitalcv.organization-os.v1', ...org, truncated },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[organization-os]', error);
    const detail = 'Organization OS failed.';
    return NextResponse.json(
      { error: 'organization_os_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
