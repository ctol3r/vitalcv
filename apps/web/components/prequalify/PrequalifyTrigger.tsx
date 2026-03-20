'use client';

/**
 * PrequalifyTrigger — routes users into the real onboarding flow.
 */

import { FEATURES } from '@/lib/features';
import { Zap } from 'lucide-react';
import Link from 'next/link';

interface PrequalifyTriggerProps {
  label?: string;
  className?: string;
  variant?: 'primary' | 'ghost';
}

export default function PrequalifyTrigger({
  label = 'Get Prequalified',
  className = '',
  variant = 'primary',
}: PrequalifyTriggerProps) {
  if (!FEATURES.PREQUALIFY_FLOW_V2) return null;

  const base = variant === 'primary'
    ? 'inline-flex items-center gap-2 rounded-full bg-vt-success px-6 py-3 text-sm font-semibold text-black hover:bg-vt-success/90 transition'
    : 'inline-flex items-center gap-2 rounded-full vt-glass px-6 py-3 text-sm font-medium text-white hover:bg-vt-surface-ops-raised transition';

  return (
    <Link href="/onboarding" className={`${base} ${className}`}>
      <Zap className="h-4 w-4" />
      {label}
    </Link>
  );
}
