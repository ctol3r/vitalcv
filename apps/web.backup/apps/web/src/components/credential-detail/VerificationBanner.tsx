/**
 * VerificationBanner Component
 * Full-width banner showing verification status
 */

'use client';

import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Credential } from '@/lib/repositories/credential-repository';
import type { AnchorStatus } from '@/lib/services/chain-service';

interface VerificationBannerProps {
  credential: Credential;
  anchorStatus: AnchorStatus;
  className?: string;
}

export function VerificationBanner({ credential, anchorStatus, className }: VerificationBannerProps) {
  const getStatus = (): 'verified' | 'warning' | 'expired' => {
    if (credential.status === 'expired' || credential.status === 'revoked') {
      return 'expired';
    }
    if (anchorStatus.mismatch || !anchorStatus.verified) {
      return 'warning';
    }
    return 'verified';
  };

  const status = getStatus();

  const config = {
    verified: {
      icon: CheckCircle2,
      text: 'Verified Credential',
      description: anchorStatus.anchored
        ? 'This credential is anchored and verified on the VitalCV Trust Ledger'
        : 'This credential has been verified',
      className: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      iconClassName: 'text-emerald-600',
    },
    warning: {
      icon: AlertTriangle,
      text: 'Verification Warning',
      description: anchorStatus.mismatch
        ? 'Anchor mismatch detected - please verify the credential status'
        : 'Verification pending or incomplete',
      className: 'bg-amber-50 border-amber-200 text-amber-900',
      iconClassName: 'text-amber-600',
    },
    expired: {
      icon: AlertCircle,
      text: 'Credential Expired',
      description:
        credential.status === 'revoked'
          ? 'This credential has been revoked by the issuer'
          : 'This credential has expired and is no longer valid',
      className: 'bg-red-50 border-red-200 text-red-900',
      iconClassName: 'text-red-600',
    },
  };

  const { icon: Icon, text, description, className: bannerClass, iconClassName } = config[status];

  return (
    <div
      className={cn(
        'w-full border rounded-lg p-4 flex items-start gap-3',
        bannerClass,
        className,
      )}
    >
      <Icon className={cn('h-5 w-5 flex-shrink-0 mt-0.5', iconClassName)} />
      <div className="flex-1 min-w-0">
        <div className="font-semibold mb-1">{text}</div>
        <div className="text-sm opacity-90">{description}</div>
      </div>
    </div>
  );
}

