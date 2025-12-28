'use client'

import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck } from 'lucide-react';
import { usePilotMode } from '@/hooks/usePilotMode';

export function PilotBanner() {
  const { pilotEnabled } = usePilotMode();
  if (!pilotEnabled) return null;

  return (
    <Alert className="mb-4 border-emerald-200 bg-emerald-50 text-emerald-900">
      <ShieldCheck className="h-4 w-4" />
      <AlertDescription>This is a pilot simulation using synthetic data.</AlertDescription>
    </Alert>
  );
}
