'use client';

/**
 * DelegatedAuthorityWidget — Supervising / collaborating physician link.
 *
 * Mid-level providers (PAs, NPs) cannot practice independently in most states.
 * The authority to practice is delegated from a supervising or collaborating
 * physician, and the agreement must be on file for the clinician's privileges
 * to be enforceable.
 *
 * This widget renders that relationship as a cryptographically linked status
 * row — NOT as a free-text note — so a reviewer can see at a glance whether
 * the delegation chain is intact.
 *
 * Doctrine
 * --------
 *   - The widget renders *nothing* when no supervisor is on file and the
 *     clinician isn't mid-level; upstream callers gate by role.
 *   - Agreement status uses the canonical trust color tokens (verified /
 *     warning / danger / unavailable) so it aligns with every other chip.
 *   - NPI is rendered in tabular-nums mono; the prefix 'NPI' is bold so the
 *     number column stays scannable even inside dense Passport layouts.
 */

import React from 'react';
import Link from 'next/link';
import {
  Check,
  Clock3,
  ExternalLink,
  Link2Off,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

void React;
import type {
  SupervisingAgreementStatus,
  SupervisingPhysicianLink,
} from '@/lib/clinical/privilege-types';

interface DelegatedAuthorityWidgetProps {
  supervisor: SupervisingPhysicianLink | null | undefined;
  /**
   * If true, render the panel even when supervisor is null (with a clear
   * "No supervising physician on file" state). Useful when the clinician's
   * role (PA / NP) makes absence itself a finding.
   */
  requireSupervisor?: boolean;
  className?: string;
}

interface AgreementBadgeStyle {
  icon: LucideIcon;
  label: string;
  iconClass: string;
  chipClass: string;
}

const AGREEMENT_STYLES: Record<SupervisingAgreementStatus, AgreementBadgeStyle> = {
  active: {
    icon: Check,
    label: 'Active & Logged',
    iconClass: 'text-[var(--vt-success)]',
    chipClass:
      'border-[color:color-mix(in_oklch,var(--vt-success)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-success)_10%,transparent)] text-[var(--vt-success)]',
  },
  pending: {
    icon: Clock3,
    label: 'Pending acknowledgment',
    iconClass: 'text-[var(--vt-info)]',
    chipClass:
      'border-[color:color-mix(in_oklch,var(--vt-info)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-info)_10%,transparent)] text-[var(--vt-info)]',
  },
  expired: {
    icon: ShieldAlert,
    label: 'Expired',
    iconClass: 'text-[var(--vt-danger)]',
    chipClass:
      'border-[color:color-mix(in_oklch,var(--vt-danger)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-danger)_10%,transparent)] text-[var(--vt-danger)]',
  },
  missing: {
    icon: Link2Off,
    label: 'No agreement on file',
    iconClass: 'text-muted-foreground/60',
    chipClass:
      'border-[var(--vt-border)] bg-white/[0.03] text-muted-foreground/70',
  },
};

const RELATIONSHIP_LABEL: Record<NonNullable<SupervisingPhysicianLink['relationship']>, string> = {
  supervisor: 'Supervising MD',
  collaborator: 'Collaborating MD',
  delegate: 'Delegate of authority',
};

function formatLoggedAt(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

export function DelegatedAuthorityWidget({
  supervisor,
  requireSupervisor = false,
  className,
}: DelegatedAuthorityWidgetProps) {
  if (!supervisor) {
    if (!requireSupervisor) return null;
    return (
      <section
        data-slot="delegated-authority"
        className={cn(
          'rounded-2xl border border-[color:color-mix(in_oklch,var(--vt-danger)_30%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-danger)_5%,transparent)] px-5 py-4',
          className,
        )}
        aria-label="Supervising physician / delegated authority"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--vt-border)] bg-black/30">
            <Link2Off className="h-3.5 w-3.5 text-[var(--vt-danger)]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
              Supervising physician / delegated authority
            </p>
            <p className="mt-1 text-sm leading-relaxed text-foreground/80">
              No supervising physician is linked to this passport.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60">
              Mid-level providers (PA, NP) require a supervising or collaborating
              physician agreement on file for delegated authority to be enforceable.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const style = AGREEMENT_STYLES[supervisor.agreementStatus];
  const Icon = style.icon;
  const relationshipLabel = RELATIONSHIP_LABEL[supervisor.relationship ?? 'supervisor'];
  const loggedAt = formatLoggedAt(supervisor.loggedAt);
  const npiValid = isValidNpi(supervisor.npi);

  return (
    <section
      data-slot="delegated-authority"
      data-agreement-status={supervisor.agreementStatus}
      className={cn(
        'rounded-2xl border border-[var(--vt-border)] bg-card px-5 py-4',
        className,
      )}
      aria-label="Supervising physician / delegated authority"
    >
      <header className="flex items-start gap-3 border-b border-white/6 pb-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--vt-border)] bg-black/30">
          <Users className="h-3.5 w-3.5 text-foreground/70" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            Supervising physician / delegated authority
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground/60">
            Cryptographically linked relationship attaches the delegate's authority
            to a licensed supervising provider.
          </p>
        </div>
      </header>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="space-y-2">
          <div>
            <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
              {relationshipLabel}
            </p>
            <p className="mt-0.5 text-sm font-bold uppercase tracking-tight text-foreground">
              {supervisor.displayName}
            </p>
            {supervisor.specialty && (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/70">
                {supervisor.specialty}
                {supervisor.state ? ` · ${supervisor.state}` : ''}
              </p>
            )}
          </div>

          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-[11px]">
            <div className="flex items-baseline gap-1.5">
              <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                NPI
              </dt>
              <dd
                className={cn(
                  'font-mono tabular-nums',
                  npiValid ? 'text-foreground/85' : 'text-[var(--vt-warning)]',
                )}
                aria-label={`Supervising NPI ${supervisor.npi}`}
              >
                {supervisor.npi}
              </dd>
              {!npiValid && (
                <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--vt-warning)]">
                  malformed
                </span>
              )}
            </div>
            {loggedAt && (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/50">
                  Logged
                </dt>
                <dd className="font-mono tabular-nums text-foreground/75">
                  <time dateTime={supervisor.loggedAt ?? undefined}>{loggedAt}</time>
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest',
              style.chipClass,
            )}
            data-agreement-chip
          >
            <Icon className={cn('h-3 w-3', style.iconClass)} aria-hidden="true" />
            {style.label}
          </span>
          {supervisor.agreementHref && (
            <Link
              href={supervisor.agreementHref}
              className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              View agreement
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

export default DelegatedAuthorityWidget;
