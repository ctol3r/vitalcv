import * as React from 'react';
import type { Metadata } from 'next';

import {
  VERB_META,
  computeDossierCounts,
  demoDossier,
  isChainConsistent,
  type CustodyRow,
  type DossierMeta,
  type ReceiptDetail,
  type RegMappingRow,
} from '@/lib/dossier/dossierData';

export const metadata: Metadata = {
  title: 'Cryptographic Proof Dossier · Demo · VitalCV',
  description:
    'Demo render of a cryptographic proof dossier — chain-of-custody ledger, receipt envelope, regulatory mapping. Stub signatures only.',
};

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

const TONE_BADGE: Record<string, string> = {
  emerald: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
  slate: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
  indigo: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700',
  rose: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
  purple: 'border-purple-500/30 bg-purple-500/10 text-purple-700',
};

export default async function DossierPage({ params }: PageProps) {
  // The receiptId from the URL is intentionally unused in Phase 1 —
  // the page always renders the demoDossier. A later phase wires
  // this to a real DossierState row.
  await params;
  const d = demoDossier();
  const counts = computeDossierCounts(d);
  const chainOk = isChainConsistent(d.ledger);

  return (
    <main
      className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8"
      data-testid="dossier-page"
      data-is-demo={String(d.meta.isDemo)}
      data-receipt-count={String(d.meta.receiptCount)}
      data-chain-consistent={String(chainOk)}
    >
      <DossierHeader meta={d.meta} counts={counts} />

      <p
        className="mt-4 inline-block rounded-md bg-amber-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-800"
        data-testid="dossier-demo-banner"
      >
        Demo dossier — stub signatures, not real cryptographic outputs
      </p>

      <CountsStrip counts={counts} chainOk={chainOk} />

      <CustodyLedgerSection ledger={d.ledger} />

      <ReceiptDetailSection receipt={d.receiptDetail} />

      <RegMappingSection mapping={d.regMapping} />

      <ExportFormatsSection />
    </main>
  );
}

function DossierHeader({
  meta,
  counts,
}: {
  meta: DossierMeta;
  counts: ReturnType<typeof computeDossierCounts>;
}) {
  return (
    <header className="border-b border-border pb-3" data-testid="dossier-header">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Cryptographic proof dossier
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-foreground sm:text-3xl">
        {meta.subject}
      </h1>
      <p className="mt-2 text-xs text-muted-foreground">
        File {meta.fileId} · NPI {meta.npi} · {meta.receiptCount} receipts · {counts.satisfiedStandards}/{counts.totalStandards} standards satisfied
      </p>
      <p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        Generated {meta.generatedAt} · by {meta.generatedBy}
      </p>
      <p className="mt-1 text-[10px] font-mono text-muted-foreground/70">
        Algorithm: {meta.algorithm} · Signing key: {meta.signingKey}
      </p>
    </header>
  );
}

function CountsStrip({
  counts,
  chainOk,
}: {
  counts: ReturnType<typeof computeDossierCounts>;
  chainOk: boolean;
}) {
  const cells = [
    { label: 'Total receipts',   value: counts.total,                                      testId: 'count-total' },
    { label: 'Source-confirmed', value: counts.byVerb.source_confirmed,                    testId: 'count-source-confirmed' },
    { label: 'Attested',         value: counts.byVerb.attested,                            testId: 'count-attested' },
    { label: 'Anchored',         value: counts.byVerb.anchored,                            testId: 'count-anchored' },
    { label: 'Standards aligned', value: `${counts.satisfiedStandards}/${counts.totalStandards}`, testId: 'count-standards' },
    { label: 'Chain check',      value: chainOk ? 'OK' : 'BROKEN',                         testId: 'count-chain' },
  ];
  return (
    <section
      aria-labelledby="counts-heading"
      className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6"
      data-testid="dossier-counts-strip"
    >
      <h2 id="counts-heading" className="sr-only">Dossier counts</h2>
      {cells.map((c) => (
        <div
          key={c.testId}
          className="rounded-md border border-border bg-card p-3"
          data-testid={c.testId}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {c.label}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground tabular-nums">
            {c.value}
          </p>
        </div>
      ))}
    </section>
  );
}

function CustodyLedgerSection({ ledger }: { ledger: ReadonlyArray<CustodyRow> }) {
  return (
    <section
      aria-labelledby="ledger-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="dossier-custody-section"
    >
      <h2 id="ledger-heading" className="text-base font-semibold sm:text-lg">
        Chain of custody
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        One row per primary-source check, attestation, committee action, or
        anchor checkpoint. Each row&rsquo;s prev hash matches the previous
        row&rsquo;s hash; a broken chain would surface as a &quot;BROKEN&quot;
        badge above.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="dossier-custody-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">#</th>
              <th className="px-2 py-1.5">Timestamp</th>
              <th className="px-2 py-1.5">Actor</th>
              <th className="px-2 py-1.5">Kind</th>
              <th className="px-2 py-1.5">Verb</th>
              <th className="px-2 py-1.5">Status</th>
              <th className="px-2 py-1.5">Latency</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map((r, i) => {
              const meta = VERB_META[r.verb];
              return (
                <tr
                  key={r.id}
                  className="border-b border-border/50"
                  data-row-id={r.id}
                  data-row-verb={r.verb}
                  data-row-method={r.method}
                >
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, '0')}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.ts}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">{r.actor}</td>
                  <td className="px-2 py-1.5">{r.kind}</td>
                  <td className="px-2 py-1.5">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${TONE_BADGE[meta.tone]}`}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px]">
                    {r.method} · {r.status}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] tabular-nums">
                    {r.latencyMs}ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReceiptDetailSection({ receipt }: { receipt: ReceiptDetail }) {
  return (
    <section
      aria-labelledby="receipt-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="dossier-receipt-detail"
      data-receipt-id={receipt.id}
    >
      <h2 id="receipt-heading" className="text-base font-semibold sm:text-lg">
        Receipt envelope (drilldown)
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        VC 2.0 envelope shape with stub signature. Real EdDSA signing,
        RFC3161 timestamp anchoring, and signed-PDF export land in a later
        phase — the present render shows the audit-relevant fields.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <KvCard
          label="Envelope"
          rows={[
            { k: 'type',        v: receipt.envelope.type },
            { k: 'version',     v: receipt.envelope.version },
            { k: 'issuedAt',    v: receipt.envelope.issuedAt },
            { k: 'issuer',      v: receipt.envelope.issuer },
            { k: 'check',       v: receipt.envelope.check },
            { k: 'method',      v: receipt.envelope.method },
            { k: 'chainIndex',  v: String(receipt.envelope.chainIndex) },
          ]}
          testId="kv-envelope"
        />
        <KvCard
          label="Subject + result"
          rows={[
            { k: 'subject.npi',  v: receipt.envelope.subject.npi },
            { k: 'subject.name', v: receipt.envelope.subject.name },
            { k: 'result.matches', v: String(receipt.envelope.result.matches) },
            { k: 'result.status',  v: receipt.envelope.result.status },
            { k: 'evidenceUrl',     v: receipt.envelope.evidenceUrl },
            { k: 'evidenceSha256',  v: receipt.envelope.evidenceSha256 },
          ]}
          testId="kv-subject"
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <KvCard
          label="Hash chain"
          rows={[
            { k: 'prev', v: receipt.envelope.prev },
            { k: 'hash', v: receipt.envelope.hash },
          ]}
          mono
          testId="kv-chain"
        />
        <KvCard
          label="Signature (stub)"
          rows={[
            { k: 'alg', v: receipt.signature.alg },
            { k: 'kid', v: receipt.signature.kid },
            { k: 'sig', v: receipt.signature.sig },
          ]}
          mono
          testId="kv-signature"
        />
      </div>
    </section>
  );
}

function KvCard({
  label,
  rows,
  mono,
  testId,
}: {
  label: string;
  rows: ReadonlyArray<{ k: string; v: string }>;
  mono?: boolean;
  testId: string;
}) {
  return (
    <div
      className="rounded border border-border/60 bg-background/40 p-3"
      data-testid={testId}
    >
      <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <dl className="mt-2 grid grid-cols-1 gap-1">
        {rows.map((r) => (
          <div key={r.k} className="flex items-baseline justify-between gap-3">
            <dt className="text-[10px] font-mono text-muted-foreground/80">{r.k}</dt>
            <dd
              className={[
                'text-[11px] tabular-nums break-all text-right',
                mono ? 'font-mono' : '',
              ].join(' ')}
            >
              {r.v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RegMappingSection({ mapping }: { mapping: ReadonlyArray<RegMappingRow> }) {
  return (
    <section
      aria-labelledby="reg-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="dossier-reg-mapping"
    >
      <h2 id="reg-heading" className="text-base font-semibold sm:text-lg">
        Regulatory mapping
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Each receipt is mapped to the standard it satisfies (NCQA / TJC / CMS).
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs" data-testid="dossier-reg-table">
          <thead>
            <tr className="border-b border-border text-left text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <th className="px-2 py-1.5">Receipt</th>
              <th className="px-2 py-1.5">Authority</th>
              <th className="px-2 py-1.5">Standard</th>
              <th className="px-2 py-1.5">Topic</th>
              <th className="px-2 py-1.5">Satisfied</th>
            </tr>
          </thead>
          <tbody>
            {mapping.map((m, i) => (
              <tr
                key={`${m.receiptId}-${i}`}
                className="border-b border-border/50"
                data-mapping-receipt={m.receiptId}
                data-mapping-authority={m.authority}
                data-mapping-satisfied={String(m.satisfied)}
              >
                <td className="px-2 py-1.5 font-mono text-[10px]">{m.receiptId}</td>
                <td className="px-2 py-1.5 font-mono text-[10px]">{m.authority}</td>
                <td className="px-2 py-1.5 font-mono text-[10px]">{m.std}</td>
                <td className="px-2 py-1.5">{m.topic}</td>
                <td className="px-2 py-1.5">
                  <span
                    className={[
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider',
                      m.satisfied
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : 'border-rose-500/30 bg-rose-500/10 text-rose-700',
                    ].join(' ')}
                  >
                    {m.satisfied ? 'aligned' : 'gap'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ExportFormatsSection() {
  return (
    <section
      aria-labelledby="export-heading"
      className="mt-8 rounded-md border border-border bg-card p-5"
      data-testid="dossier-export-section"
    >
      <h2 id="export-heading" className="text-base font-semibold sm:text-lg">
        Export
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Three planned export formats. All are disabled in Phase 1 — real
        cryptographic signing, signed-PDF rendering, and time-bound auditor
        link issuance land in a later phase.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { id: 'json',    label: 'JSON ledger',           sub: 'Machine-readable receipt envelope chain' },
          { id: 'pdf',     label: 'Signed PDF binder',     sub: 'Audit-ready, signature-anchored' },
          { id: 'auditor', label: 'Time-bound auditor link', sub: 'Read-only · expires after window' },
        ].map((f) => (
          <li
            key={f.id}
            className="rounded border border-border/60 bg-background/40 p-3"
            data-testid="export-option"
            data-export-id={f.id}
          >
            <p className="text-sm font-medium text-foreground">{f.label}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{f.sub}</p>
            <button
              type="button"
              disabled
              title="Export wiring — Phase 2"
              className="mt-3 inline-flex items-center rounded border border-border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider opacity-50 cursor-not-allowed"
              data-testid="export-button"
              data-disabled-reason="phase-2-pending"
            >
              Export (Phase 2)
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
