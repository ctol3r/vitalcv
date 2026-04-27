import * as React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Clinician Knowledge Graph Preview · VitalCV',
  description:
    'A static preview of how the Knowledge Trust Graph organizes claims, sources, evidence, and receipts for a clinician. The graph explains provenance and gaps. It does not verify a claim by itself.',
};

type NodeKind =
  | 'clinician'
  | 'npi'
  | 'education-claim'
  | 'employer-claim'
  | 'publication-claim'
  | 'source'
  | 'receipt'
  | 'unknown'
  | 'user-entered';

interface NodeDef {
  id: string;
  label: string;
  kind: NodeKind;
  hint: string;
}

interface EdgeDef {
  from: string;
  to: string;
  label: string;
}

const NODES: ReadonlyArray<NodeDef> = [
  { id: 'clinician', label: 'Dr. Sample, MD', kind: 'clinician', hint: 'The clinician this profile describes.' },
  { id: 'npi', label: 'NPI 1234567890', kind: 'npi', hint: 'Identifier resolved against NPPES (federal source of record).' },
  { id: 'edu-1', label: 'Medical school: Sample School of Medicine, MD, 2012', kind: 'education-claim', hint: 'A claim made about the clinician.' },
  { id: 'emp-1', label: 'Current employer: Sample Health System (Cardiology, attending)', kind: 'employer-claim', hint: 'A claim about current employment.' },
  { id: 'pub-1', label: 'Publication: "Sample title" (PubMed:00000000)', kind: 'publication-claim', hint: 'A claim about a publication.' },
  { id: 'source-nppes', label: 'Source: NPPES', kind: 'source', hint: 'A source-of-record check has run against NPPES.' },
  { id: 'source-pubmed', label: 'Source: PubMed', kind: 'source', hint: 'PubMed lookup ran but is treated as imported-candidate, not source-backed PSV.' },
  { id: 'receipt-nppes', label: 'Receipt: NPPES check, freshness 24h', kind: 'receipt', hint: 'A receipt records that a check ran. It is not a verification of the underlying claim.' },
  { id: 'unknown-board-cert', label: 'Unknown: board certification', kind: 'unknown', hint: 'No data from any source. Neutral — not evidence of absence.' },
  { id: 'user-entered-affiliation', label: 'User-entered: Hospital privileges at Sample Hospital', kind: 'user-entered', hint: 'Provided by the clinician. Not source-backed.' },
];

const EDGES: ReadonlyArray<EdgeDef> = [
  { from: 'clinician', to: 'npi', label: 'identified by' },
  { from: 'npi', to: 'source-nppes', label: 'resolved against' },
  { from: 'source-nppes', to: 'receipt-nppes', label: 'produced' },
  { from: 'clinician', to: 'edu-1', label: 'claims' },
  { from: 'clinician', to: 'emp-1', label: 'claims' },
  { from: 'clinician', to: 'pub-1', label: 'claims' },
  { from: 'pub-1', to: 'source-pubmed', label: 'imported from (candidate)' },
  { from: 'clinician', to: 'unknown-board-cert', label: 'has gap' },
  { from: 'clinician', to: 'user-entered-affiliation', label: 'self-attests' },
];

const KIND_LABEL: Record<NodeKind, string> = {
  clinician: 'Clinician',
  npi: 'NPI',
  'education-claim': 'Claim',
  'employer-claim': 'Claim',
  'publication-claim': 'Claim',
  source: 'Source',
  receipt: 'Receipt',
  unknown: 'Unknown',
  'user-entered': 'User-entered',
};

const KIND_CLASS: Record<NodeKind, string> = {
  clinician: 'border-foreground/20 bg-foreground/5 text-foreground',
  npi: 'border-sky-500/40 bg-sky-500/10 text-sky-700',
  'education-claim': 'border-violet-500/40 bg-violet-500/10 text-violet-700',
  'employer-claim': 'border-violet-500/40 bg-violet-500/10 text-violet-700',
  'publication-claim': 'border-violet-500/40 bg-violet-500/10 text-violet-700',
  source: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  receipt: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700',
  unknown: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  'user-entered': 'border-amber-500/40 bg-amber-500/10 text-amber-700',
};

export default function ClinicianGraphPreviewPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 sm:mb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Knowledge Trust Graph preview
        </p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
          How VitalCV organizes claims, sources, evidence, and receipts
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          <strong>The graph explains provenance and gaps. It does not verify a
          claim by itself.</strong> Verification requires a source-backed check
          that produces a receipt, and a credentialing reviewer to inspect that
          receipt against policy.
        </p>
      </header>

      <section aria-labelledby="legend-heading" className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5">
        <h2 id="legend-heading" className="text-sm font-semibold">
          Legend
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {(['clinician', 'npi', 'education-claim', 'source', 'receipt', 'unknown', 'user-entered'] as NodeKind[]).map((k) => (
            <li key={k} className={`inline-flex items-center justify-center rounded-full border px-2 py-1 ${KIND_CLASS[k]}`}>
              {KIND_LABEL[k]}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="nodes-heading" className="mb-8">
        <h2 id="nodes-heading" className="text-lg font-semibold">
          Sample nodes
        </h2>
        <ul className="mt-3 space-y-2">
          {NODES.map((node) => (
            <li
              key={node.id}
              className={`rounded-lg border p-3 text-sm ${KIND_CLASS[node.kind]}`}
            >
              <p className="font-medium">{node.label}</p>
              <p className="mt-0.5 text-[11px] opacity-80">{node.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="edges-heading">
        <h2 id="edges-heading" className="text-lg font-semibold">
          Sample edges
        </h2>
        <ul className="mt-3 space-y-1.5 text-sm">
          {EDGES.map((edge, i) => {
            const fromNode = NODES.find((n) => n.id === edge.from);
            const toNode = NODES.find((n) => n.id === edge.to);
            return (
              <li
                key={`${edge.from}-${edge.to}-${i}`}
                className="rounded-lg border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] px-3 py-2 font-mono text-xs"
              >
                <span className="opacity-70">{fromNode?.label ?? edge.from}</span>
                <span className="mx-2 opacity-50">— {edge.label} →</span>
                <span className="opacity-90">{toNode?.label ?? edge.to}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 text-xs leading-relaxed text-muted-foreground">
        Visual graph layout (Roam/Obsidian-style canvas) is a separate wave.
        This preview lists the same node and edge types in plain text so the
        invariants are auditable. <strong>The graph explains provenance and
        gaps. It does not verify a claim by itself.</strong>
      </p>
    </main>
  );
}
