'use client';

import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { ClaimBadge } from '@/components/ui/claim-badge';
import type { ClaimLevel } from '@/components/trust-state/types';
import type { CredentialStatus } from '@/components/trust-state/types';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Briefcase,
  FileText,
  GraduationCap,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CredentialCardData {
  id: string;
  type: string;
  name: string;
  issuer: string;
  status: CredentialStatus;
  claimLevel: ClaimLevel;
  expirationDate?: string;
  issueDate?: string;
}

/* ------------------------------------------------------------------ */
/*  Icon mapping                                                       */
/* ------------------------------------------------------------------ */

const TYPE_ICONS: Record<string, React.ElementType> = {
  STATE_LICENSE: ShieldCheck,
  BOARD_CERTIFICATION: Award,
  DEA_REGISTRATION: Stethoscope,
  NPI_ENROLLMENT: BadgeCheck,
  EDUCATION: GraduationCap,
  TRAINING: BookOpen,
  WORK_HISTORY: Briefcase,
};

const STATUS_TEXT: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
  SUSPENDED: 'Suspended',
  PENDING: 'Pending',
  NOT_FOUND: 'Not Found',
  UNKNOWN: 'Unknown',
};

const CLAIM_LEVEL_TEXT: Record<string, string> = {
  L0: 'Unverified',
  L1: 'Self-Reported',
  L2: 'Document Verified',
  L3: 'Primary Source Verified',
};

/* ------------------------------------------------------------------ */
/*  CredentialCard                                                     */
/* ------------------------------------------------------------------ */

export function CredentialCard({
  credential,
  className,
}: {
  credential: CredentialCardData;
  className?: string;
}) {
  const Icon = TYPE_ICONS[credential.type] ?? FileText;
  const isExpired = credential.status === 'EXPIRED' || credential.status === 'REVOKED';
  const statusLabel = STATUS_TEXT[credential.status] ?? credential.status;

  const expiryFormatted = credential.expirationDate
    ? new Date(credential.expirationDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <GlassCard
      className={cn(
        'group relative overflow-hidden transition-all duration-200 hover:shadow-md',
        isExpired && 'opacity-70',
        className,
      )}
    >
      <GlassCardContent className="pt-10 pb-10 px-8 space-y-6">
        {/* Claim badge — top right */}
        <div className="absolute top-5 right-5">
          <ClaimBadge level={credential.claimLevel} />
        </div>

        {/* Icon + Type */}
        <div className="flex items-start gap-5">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary/8 text-primary shrink-0">
            <Icon className="h-7 w-7" />
          </div>
          <div className="min-w-0 pr-16">
            <p className="font-heading font-semibold text-2xl leading-snug">
              {credential.name}
            </p>
            <p className="text-base text-muted-foreground truncate mt-1.5">
              {credential.issuer}
            </p>
          </div>
        </div>

        {/* Structured details */}
        <div className="space-y-4 pt-2">
          {/* Credential Status */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">
              Credential Status
            </p>
            <span
              className={cn(
                'flex items-center gap-2.5 text-lg font-medium',
                isExpired ? 'text-destructive' : 'text-foreground',
              )}
            >
              <span
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  credential.status === 'ACTIVE'
                    ? 'bg-[var(--trust-green)]'
                    : credential.status === 'PENDING'
                      ? 'bg-[var(--trust-yellow)]'
                      : isExpired
                        ? 'bg-destructive'
                        : 'bg-muted-foreground/50',
                )}
              />
              {statusLabel}
            </span>
          </div>

          {/* Expiration */}
          {expiryFormatted && (
            <div>
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                Expiration
              </p>
              <p className={cn('text-lg', isExpired ? 'text-destructive' : 'text-foreground')}>
                {isExpired ? 'Expired' : 'Expires'} {expiryFormatted}
              </p>
            </div>
          )}

          {/* Verification Level */}
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5">
              Verification Level
            </p>
            <p className="text-lg text-foreground">
              {CLAIM_LEVEL_TEXT[credential.claimLevel] ?? credential.claimLevel}
            </p>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
