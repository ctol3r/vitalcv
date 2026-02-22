'use client';

import { ShieldCheck } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  ApplyWithVitalCV — embeddable widget                               */
/*                                                                     */
/*  A self-contained button that employers embed on their career pages  */
/*  to let clinicians apply using their VitalCV credential wallet.      */
/*  In production this would open an OAuth / OIDC4VCI flow.             */
/* ------------------------------------------------------------------ */

interface ApplyWithVitalCVProps {
  /** The employer's unique ID in VitalCV */
  employerId: string;
  /** Job / position identifier */
  positionId?: string;
  /** Visual variant */
  variant?: 'primary' | 'outline' | 'minimal';
  /** Button label override */
  label?: string;
  /** Callback when flow completes (in embedded context) */
  onComplete?: (result: { profileId: string; status: 'shared' | 'cancelled' }) => void;
}

export function ApplyWithVitalCV({
  employerId,
  positionId,
  variant = 'primary',
  label = 'Apply with VitalCV',
  onComplete,
}: ApplyWithVitalCVProps) {
  const handleClick = () => {
    // In production: open VitalCV auth/consent popup
    // For now: demo callback
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams({
      employer: employerId,
      ...(positionId && { position: positionId }),
      flow: 'apply',
    });

    // Open consent flow in popup
    const popup = window.open(
      `${baseUrl}/holder?${params.toString()}`,
      'vitalcv-apply',
      'width=480,height=640,menubar=no,toolbar=no,status=no',
    );

    // Listen for completion message
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'vitalcv:apply-complete') {
        onComplete?.(event.data.result);
        window.removeEventListener('message', handler);
        popup?.close();
      }
    };
    window.addEventListener('message', handler);
  };

  const baseStyles =
    'inline-flex items-center gap-2 font-medium rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variants = {
    primary:
      'px-5 py-2.5 text-sm bg-foreground text-background hover:opacity-90 focus:ring-foreground',
    outline:
      'px-5 py-2.5 text-sm border-2 border-foreground text-foreground hover:bg-foreground/5 focus:ring-foreground',
    minimal:
      'px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline focus:ring-foreground/40',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${baseStyles} ${variants[variant]}`}
    >
      <ShieldCheck className={variant === 'minimal' ? 'h-3 w-3' : 'h-4 w-4'} />
      {label}
    </button>
  );
}
