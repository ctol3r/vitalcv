/**
 * PassportPreviewCard — presentational demo/preview of a readiness snapshot.
 *
 * Explicitly labeled "Demo Data" so viewers cannot mistake it for a live run.
 * Composes the canonical TrustStatusBadge primitive; introduces no new types,
 * no new readiness computation, no new source states.
 */

import { AlertCircle, ArrowRight, Eye } from 'lucide-react';
import Link from 'next/link';
import { TrustClaim, type TrustClaimKind } from '@/components/trust-state/TrustClaim';

type DemoRow = { label: string; kind: TrustClaimKind };

const DEMO_ROWS: ReadonlyArray<DemoRow> = [
  { label: 'NPPES', kind: 'verified' },
  { label: 'OIG / LEIE', kind: 'verified' },
  { label: 'CMS PECOS', kind: 'verified' },
  { label: 'State Board', kind: 'gated' },
];

const DEMO_BLOCKER = 'State board access required before decision-grade readiness';
const DEMO_ACTION = 'Authorize state board access';

interface PassportPreviewCardProps {
  demo?: boolean;
}

export function PassportPreviewCard({ demo = false }: PassportPreviewCardProps) {
  return (
    <div className="glass rounded-2xl p-6 space-y-5 transition-transform duration-200 ease-out hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Sample readiness snapshot
        </p>
        {demo ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <Eye aria-hidden="true" className="h-2.5 w-2.5" />
            Demo Data
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-lg font-semibold text-foreground">[Your Name]</p>
        <p className="text-sm text-muted-foreground">[Specialty] · NPI [Your NPI]</p>
      </div>

      <div className="space-y-2">
        {DEMO_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <TrustClaim kind={row.kind} size="sm" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Readiness</span>
          <span className="text-xs font-semibold text-trust-green">READY</span>
        </div>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">82/100</p>
      </div>

      {/* Blocker — explicit, unambiguous, labelled. Not presented as a warning
          the user can dismiss — this is inspectable state. */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500/80">
            Blocker
          </p>
          <p className="mt-0.5 text-xs text-foreground/80">{DEMO_BLOCKER}</p>
        </div>
      </div>

      {/* Single action — the one forward motion to resolve the blocker above. */}
      <Link
        href="/passport"
        className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
      >
        {DEMO_ACTION}
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>

      <p className="text-[10px] text-muted-foreground/50 text-center">
        {demo
          ? 'Demo data — enter your NPI to see your real snapshot'
          : 'Enter your NPI to see real results'}
      </p>
    </div>
  );
}
