import type { IntelligenceView } from '@/lib/intelligence/routes';

function envFlag(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return value === 'true' || value === '1';
}

export const PILOT_FLAGS = {
  enableInvestigations: envFlag('NEXT_PUBLIC_PILOT_ENABLE_INVESTIGATIONS', true),
  enableCalibration: envFlag('NEXT_PUBLIC_PILOT_ENABLE_CALIBRATION', false),
  enableSystemHealth: envFlag('NEXT_PUBLIC_PILOT_ENABLE_SYSTEM_HEALTH', false),
} as const;

export type PilotFlagKey = keyof typeof PILOT_FLAGS;

export function isPilotIntelligenceViewEnabled(view: IntelligenceView): boolean {
  switch (view) {
    case 'investigations':
      return PILOT_FLAGS.enableInvestigations;
    case 'calibration':
      return PILOT_FLAGS.enableCalibration;
    case 'system-health':
      return PILOT_FLAGS.enableSystemHealth;
    default:
      return true;
  }
}

export function getPilotIntelligenceNav() {
  return [
    { key: 'dashboard', href: '/intelligence?view=dashboard', label: 'Monitor' },
    ...(PILOT_FLAGS.enableInvestigations
      ? [{ key: 'investigations', href: '/intelligence?view=investigations', label: 'Investigate' } as const]
      : []),
    { key: 'actions', href: '/intelligence?view=actions', label: 'Decide' },
  ];
}
