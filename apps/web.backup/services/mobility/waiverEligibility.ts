import type { CompactEligibilityV2Result, CompactV2Type } from './compactEligibilityV2.js';

interface WaiverProgramDefinition {
  id: string;
  state: string;
  name: string;
  trigger: string;
  windowDays: number;
  requiresCompact?: CompactV2Type;
  summary: string;
}

const WAIVER_PROGRAMS: WaiverProgramDefinition[] = [
  {
    id: 'ca-disaster',
    state: 'CA',
    name: 'California Emergency Medical Services Waiver',
    trigger: 'Wildfire / earthquake declarations',
    windowDays: 90,
    requiresCompact: 'IMLC',
    summary: 'Automatically waives site-specific credentialing for physicians routed through IMLC with verified telemetry.',
  },
  {
    id: 'fl-hurricane',
    state: 'FL',
    name: 'Florida Hurricane Response Waiver',
    trigger: 'Hurricane season incidents',
    windowDays: 60,
    requiresCompact: 'NLC',
    summary: 'Enables multi-state nurses to deploy within Florida health systems with 24-hour notice.',
  },
  {
    id: 'wa-telehealth',
    state: 'WA',
    name: 'Washington Telehealth Relief Program',
    trigger: 'State public-health emergency',
    windowDays: 120,
    requiresCompact: 'PSYPACT',
    summary: 'Extends temporary telehealth privileges for behavioral health providers aligned to PSYPACT.',
  },
];

export interface WaiverProgramResult {
  id: string;
  state: string;
  name: string;
  trigger: string;
  summary: string;
  windowDays: number;
  requiresCompact?: CompactV2Type;
  eligible: boolean;
  reason: string;
}

export interface WaiverEligibilityResult {
  status: 'ready' | 'conditional' | 'blocked';
  programs: WaiverProgramResult[];
}

export interface WaiverEligibilityInput {
  licenseStates: string[];
  compacts: CompactEligibilityV2Result[];
}

export function evaluateWaiverEligibility(input: WaiverEligibilityInput): WaiverEligibilityResult {
  const licenseStates = new Set((input.licenseStates ?? []).map((state) => state.toUpperCase()));
  const compactStatus = new Map(
    (input.compacts ?? []).map((entry) => [entry.compact, entry.status]),
  );

  const programs: WaiverProgramResult[] = WAIVER_PROGRAMS.map((program) => {
    const hasLicense = licenseStates.has(program.state);
    const compactEligible =
      program.requiresCompact && compactStatus.get(program.requiresCompact) === 'eligible';
    const eligible = hasLicense || compactEligible;

    let reason: string;
    if (eligible && compactEligible) {
      reason = `${program.requiresCompact} compact unlocks auto-approval`;
    } else if (eligible) {
      reason = `Active license on file for ${program.state}`;
    } else if (program.requiresCompact) {
      reason = `Activate ${program.requiresCompact} or add license for ${program.state}`;
    } else {
      reason = `Add license for ${program.state}`;
    }

    return {
      id: program.id,
      state: program.state,
      name: program.name,
      trigger: program.trigger,
      summary: program.summary,
      windowDays: program.windowDays,
      requiresCompact: program.requiresCompact,
      eligible,
      reason,
    };
  });

  const readyCount = programs.filter((program) => program.eligible).length;
  const needsCompact = programs.some(
    (program) => !program.eligible && program.requiresCompact !== undefined,
  );

  let status: WaiverEligibilityResult['status'] = 'blocked';
  if (readyCount > 0) {
    status = 'ready';
  } else if (needsCompact) {
    status = 'conditional';
  }

  return {
    status,
    programs,
  };
}









