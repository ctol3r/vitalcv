'use client';

/**
 * My Network (Wave 300, D4) — the organizations connected to a clinician,
 * projected from source-backed evidence (training institutions, credential
 * issuers, licensing boards, verification authorities, employers). Read-only;
 * an org's trust contribution is bounded (gated org contributes 0).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { OrganizationGraph, OrganizationKind } from '@vitalcv/domain-evidence';

const KIND_LABELS: Record<OrganizationKind, string> = {
  employer: 'Employers',
  training_institution: 'Training Programs',
  credential_issuer: 'Credential Issuers',
  licensing_board: 'Licensing Boards',
  verification_authority: 'Verification Authorities',
  other: 'Other',
};

const KIND_ORDER: OrganizationKind[] = ['employer', 'training_institution', 'credential_issuer', 'licensing_board', 'verification_authority', 'other'];

export default function NetworkClient({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<OrganizationGraph | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/organizations/${encodeURIComponent(entityId)}`, { cache: 'no-store' });
      if (cancelled) return;
      setGraph(res.ok ? ((await res.json()) as OrganizationGraph) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  if (loading) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p className="text-sm text-muted-foreground">Loading network…</p></main>;
  if (!graph) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p className="text-sm text-muted-foreground">Network not available.</p></main>;

  const relFor = (orgId: string) => graph.relationships.find((r) => r.to === orgId)?.type ?? '';
  const grouped = KIND_ORDER.map((kind) => ({ kind, orgs: graph.organizations.filter((o) => o.kind === kind) })).filter((g) => g.orgs.length > 0);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">My Network</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Career Relationships</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {graph.stats.organizationCount} organization{graph.stats.organizationCount === 1 ? '' : 's'} · {graph.stats.decisionGradeOrganizations} with decision-grade evidence
            {' · '}<Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="hover:text-foreground">← Ecosystem</Link>
          </p>
        </header>

        {grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground">No source-backed organizations yet.</p>
        ) : grouped.map(({ kind, orgs }) => (
          <section key={kind} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{KIND_LABELS[kind]}</h2>
            <ul className="divide-y divide-border">
              {orgs.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{o.label}</p>
                    <p className="text-xs text-muted-foreground">{relFor(o.id).replace(/_/g, ' ').toLowerCase()} · {o.evidenceCount} evidence item{o.evidenceCount === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {o.decisionGradeCount > 0 ? `${o.decisionGradeCount} decision-grade` : 'not decision-grade'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
