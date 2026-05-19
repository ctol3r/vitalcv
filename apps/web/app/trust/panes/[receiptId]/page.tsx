/**
 * /trust/panes/[receiptId] — Stacked Provenance Ledger
 *
 * Server Component. Fetches a `ReplayInspection` and renders a
 * Matuschak-style URL-driven stacked-pane interface. The root pane is
 * the receipt; pushing pane stacks via `?panes=...` reveals audit
 * events, claims, lineage keys, and entity bindings.
 *
 * Bi-directional cryptographic visibility: opening any deeper pane
 * renders `LineageBacklinks` showing every artifact that binds TO it.
 */

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getReplayInspection } from '@/lib/replay/getReplayInspection';
import { PanesClient } from './PanesClient';

export const metadata: Metadata = {
  title: 'Stacked Provenance Ledger · VitalCV',
  description:
    'URL-driven sliding-pane interface for trust artifact exploration.',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ receiptId: string }>;
}

export default async function StackedProvenancePage({ params }: PageProps) {
  const { receiptId } = await params;

  if (!receiptId || !/^(rcpt_|rec-)/.test(receiptId)) {
    notFound();
  }

  const inspection = await getReplayInspection(receiptId);
  if (!inspection) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-900 bg-slate-950 px-5 py-3 font-mono text-xs uppercase tracking-wider text-slate-100">
        Stacked provenance ledger · {receiptId}
      </header>
      <div className="h-[calc(100vh-3rem)]">
        <PanesClient inspection={inspection} />
      </div>
    </main>
  );
}
