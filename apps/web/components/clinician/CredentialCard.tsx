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
      <GlassCardContent className="pt-4 pb-4 space-y-3">
        {/* Claim badge — top right */}
        <div className="absolute top-3 right-3">
          <ClaimBadge level={credential.claimLevel} />
        </div>

        {/* Icon + Type */}
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/8 text-primary shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 pr-16">
            <p className="font-heading font-semibold text-sm leading-tight truncate">
              {credential.name}
            </p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {credential.issuer}
            </p>
          </div>
        </div>

        {/* Status + Expiry */}
        <div className="flex items-center justify-between text-xs">
          <span
            className={cn(
              'flex items-center gap-1.5',
              isExpired ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
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
          {expiryFormatted && (
            <span className="text-muted-foreground/70">
              {isExpired ? 'Expired' : 'Exp.'} {expiryFormatted}
            </span>
          )}
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
