'use client';

/**
 * Unified Search (Wave 300, D5) — searches across a clinician's OWN career
 * ecosystem: evidence, organizations, and career events. Honest scope: this is
 * within-ecosystem search; cross-clinician "people" search requires a backend
 * search index and is intentionally out of scope here (not faked).
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { EvidenceCollection, OrganizationGraph, TimelineProjection } from '@vitalcv/domain-evidence';

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { cache: 'no-store' });
  return res.ok ? ((await res.json()) as T) : null;
}

interface Hit { kind: 'Evidence' | 'Organization' | 'Career Event'; label: string; detail: string }

export default function SearchClient({ entityId }: { entityId: string }) {
  const [evidence, setEvidence] = useState<EvidenceCollection | null>(null);
  const [orgs, setOrgs] = useState<OrganizationGraph | null>(null);
  const [timeline, setTimeline] = useState<TimelineProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const id = encodeURIComponent(entityId);
      const [e, o, t] = await Promise.all([
        fetchJson<EvidenceCollection>(`/api/evidence/${id}`),
        fetchJson<OrganizationGraph>(`/api/organizations/${id}`),
        fetchJson<TimelineProjection>(`/api/timeline/${id}`),
      ]);
      if (cancelled) return;
      setEvidence(e); setOrgs(o); setTimeline(t); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  const corpus: Hit[] = useMemo(() => {
    const hits: Hit[] = [];
    for (const obj of evidence?.objects ?? []) hits.push({ kind: 'Evidence', label: obj.label, detail: `${obj.evidenceClass.replace(/_/g, ' ')} · ${obj.status}` });
    for (const o of orgs?.organizations ?? []) hits.push({ kind: 'Organization', label: o.label, detail: o.kind.replace(/_/g, ' ') });
    for (const ev of timeline?.events ?? []) hits.push({ kind: 'Career Event', label: ev.label, detail: `${ev.type.replace(/_/g, ' ')} · ${ev.occurredAt ?? 'undated'}` });
    return hits;
  }, [evidence, orgs, timeline]);

  const q = query.trim().toLowerCase();
  const results = q ? corpus.filter((h) => h.label.toLowerCase().includes(q) || h.detail.toLowerCase().includes(q)) : corpus;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Search</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Career Ecosystem Search</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Across evidence, organizations, and career events.{' '}
            <Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="hover:text-foreground">← Ecosystem</Link>
          </p>
        </header>

        <label className="block">
          <span className="sr-only">Search the career ecosystem</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search evidence, organizations, events…"
            className="h-11 w-full rounded-full border border-border bg-card px-4 text-sm text-foreground outline-none focus:border-foreground"
            aria-label="Search the career ecosystem"
          />
        </label>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading ecosystem…</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{results.length} result{results.length === 1 ? '' : 's'}{q ? ` for “${query}”` : ''}</p>
            <ul className="divide-y divide-border">
              {results.map((h, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{h.label}</p>
                    <p className="text-xs text-muted-foreground">{h.detail}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{h.kind}</span>
                </li>
              ))}
            </ul>
            {results.length === 0 && <p className="text-sm text-muted-foreground">No matches in this clinician&apos;s ecosystem.</p>}
            <p className="pt-2 text-xs text-muted-foreground">
              Scope: this clinician&apos;s own source-backed ecosystem. Cross-clinician and opportunity search require a backend search index (not enabled here).
            </p>
          </>
        )}
      </div>
    </main>
  );
}
