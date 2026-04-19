'use client';

/**
 * WarrantyCoverageMatrix — brutalist, text-dense disclosure of what VitalCV
 * underwrites for a given packet.
 *
 * Designed to read as an immutable legal ledger:
 *   - Monospace throughout, tight leading, uppercase labels.
 *   - Sectioned with `§` and integer paragraph markers.
 *   - No pill buttons, no emoji, no semantic trust color beyond the
 *     established vocabulary.
 *   - Native <details>/<summary> for accessible collapse without motion
 *     library dependency — legal documents should not bounce.
 */

import { ArrowUpRight, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WarrantyCoverageMatrixProps {
  /** Primary sources this packet's warranty covers. */
  coveredSources?: string[];
  /** Per-defect coverage cap, fully formatted. */
  coverageLimit?: string;
  /** Items explicitly out of scope. */
  excludedRisks?: string[];
  /** A cryptographic fingerprint of the contract. */
  contractFingerprint?: string;
  /** Href or handler for the full legal contract. */
  contractHref?: string;
  onContractOpen?: () => void;
  /** Expand by default. */
  defaultOpen?: boolean;
  className?: string;
}

const DEFAULT_COVERED_SOURCES = ['NPPES', 'OIG/LEIE', 'PECOS', 'CA State Board'];
const DEFAULT_COVERAGE_LIMIT = '$50,000 per primary source defect';
const DEFAULT_EXCLUDED_RISKS = [
  'Local facility training',
  'Post-verification behavioral infractions',
];
const DEFAULT_FINGERPRINT = 'sha256:0xA9F4·3C7E·B21D·E8A2';

export function WarrantyCoverageMatrix({
  coveredSources = DEFAULT_COVERED_SOURCES,
  coverageLimit = DEFAULT_COVERAGE_LIMIT,
  excludedRisks = DEFAULT_EXCLUDED_RISKS,
  contractFingerprint = DEFAULT_FINGERPRINT,
  contractHref,
  onContractOpen,
  defaultOpen = false,
  className,
}: WarrantyCoverageMatrixProps) {
  return (
    <details
      data-slot="warranty-coverage-matrix"
      open={defaultOpen}
      className={cn(
        'group border border-line bg-[var(--color-bg)] font-mono text-ink',
        'open:shadow-[inset_4px_0_0_0_var(--color-ink)]',
        className,
      )}
    >
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4',
          'text-[11px] uppercase tracking-[0.18em]',
          'hover:bg-ink/5 focus-visible:outline-none focus-visible:bg-ink/5',
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-ink/40 tabular-nums">§ 01</span>
          <span className="text-ink font-semibold">Warranty &amp; Indemnity Coverage</span>
          <span className="hidden md:inline text-ink/40">·</span>
          <span className="hidden md:inline truncate text-ink/50 tracking-[0.14em] text-[10px]">
            {contractFingerprint}
          </span>
        </div>
        <div className="flex items-center gap-3 text-ink/50">
          <span className="text-[10px] tracking-[0.14em] hidden sm:inline">
            <span className="group-open:hidden">Expand</span>
            <span className="hidden group-open:inline">Collapse</span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-3 w-3 transition-transform duration-200 group-open:rotate-90"
          />
        </div>
      </summary>

      <div className="border-t border-line">
        <div className="flex items-center gap-3 border-b border-line bg-ink/[0.04] px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] text-ink/50">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink/40" aria-hidden="true" />
          <span>Ledger · Immutable on chain · Pilot Terms</span>
          <span className="ml-auto tabular-nums text-ink/40">v1.0</span>
        </div>

        <dl className="divide-y divide-line">
          <Row label="Covered_Sources">
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {coveredSources.map((src, i) => (
                <span key={src} className="flex items-center gap-2">
                  <span className="text-ink">{src}</span>
                  {i < coveredSources.length - 1 && (
                    <span className="text-ink/30" aria-hidden="true">,</span>
                  )}
                </span>
              ))}
              <span className="text-ink/40" aria-hidden="true">.</span>
            </div>
          </Row>

          <Row label="Coverage_Limit">
            <span className="text-ink tabular-nums">{coverageLimit}</span>
            <span className="text-ink/40" aria-hidden="true">.</span>
          </Row>

          <Row label="Excluded_Risks">
            <ul className="space-y-1">
              {excludedRisks.map((risk, i) => (
                <li key={risk} className="flex items-start gap-2">
                  <span className="mt-[6px] inline-block h-px w-2 shrink-0 bg-ink/40" aria-hidden="true" />
                  <span className="text-ink">
                    {risk}
                    <span className="text-ink/40" aria-hidden="true">
                      {i < excludedRisks.length - 1 ? ';' : '.'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Row>

          <Row label="Jurisdiction">
            <span className="text-ink">Delaware · 12 Del. C. § 3801 trust form</span>
            <span className="text-ink/40" aria-hidden="true">.</span>
          </Row>

          <Row label="Effective_Period">
            <span className="text-ink tabular-nums">
              Packet seal → +90d continuous monitoring
            </span>
            <span className="text-ink/40" aria-hidden="true">.</span>
          </Row>
        </dl>

        <div className="flex flex-col gap-3 border-t border-line bg-ink/[0.02] px-5 py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[10.5px] leading-relaxed text-ink/55 max-w-lg">
            Execution of [ Accept &amp; Transfer Risk ] binds Cedar Health and
            VitalCV, Inc. to the terms below. Receipt is signed with org key.
          </p>
          <ContractButton href={contractHref} onOpen={onContractOpen} />
        </div>
      </div>
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-12 gap-4 px-5 py-3.5">
      <dt className="col-span-12 md:col-span-4 xl:col-span-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
          {label}
          <span className="text-ink/25" aria-hidden="true">:</span>
        </span>
      </dt>
      <dd className="col-span-12 md:col-span-8 xl:col-span-9 text-[12px] leading-[1.55]">
        {children}
      </dd>
    </div>
  );
}

function ContractButton({
  href,
  onOpen,
}: {
  href?: string;
  onOpen?: () => void;
}) {
  const baseClass = cn(
    'group/btn inline-flex items-center gap-2 border border-line px-3 py-2',
    'text-[10px] font-semibold uppercase tracking-[0.16em] text-ink',
    'bg-transparent hover:bg-ink/5 transition-colors',
  );

  const children = (
    <>
      <span>View Full Legal Cryptographic Contract</span>
      <ArrowUpRight
        aria-hidden="true"
        className="h-3 w-3 transition-transform duration-200 group-hover/btn:-translate-y-px group-hover/btn:translate-x-px"
      />
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={baseClass}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={baseClass}>
      {children}
    </button>
  );
}

export default WarrantyCoverageMatrix;
