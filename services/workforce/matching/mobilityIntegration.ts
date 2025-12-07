import type { ClinicianProfile } from './types';

export type MobilityReadinessStatus = 'blocked' | 'portable' | 'instantly_onboardable';

export interface MobilityReadiness {
  status: MobilityReadinessStatus;
  readyInHours?: number;
  reason?: string;
}

export interface MobilityDecision {
  allowed: boolean;
  reason: string;
  readiness: MobilityReadiness;
  source: 'policy' | 'profile' | 'adapter';
}

export interface MobilityRequest {
  clinicianId: string;
  clinicianOrgId: string;
  targetOrgId: string;
  clinicianProfile?: ClinicianProfile;
}

export interface MobilityEngineAdapter {
  lookupReadiness(request: MobilityRequest): Promise<MobilityReadiness>;
}

class NullMobilityAdapter implements MobilityEngineAdapter {
  async lookupReadiness(): Promise<MobilityReadiness> {
    return {
      status: 'portable',
      readyInHours: 72,
      reason: 'Default portable status; provide a mobility adapter to override.',
    };
  }
}

export class MobilityIntegration {
  constructor(private readonly adapter: MobilityEngineAdapter = new NullMobilityAdapter()) {}

  async canMatch(request: MobilityRequest): Promise<MobilityDecision> {
    if (request.clinicianOrgId === request.targetOrgId) {
      return {
        allowed: true,
        reason: 'Same-organization demand',
        readiness: { status: 'instantly_onboardable' },
        source: 'policy',
      };
    }

    const profileDecision = this.evaluateProfile(request);
    if (profileDecision) {
      return profileDecision;
    }

    const readiness = await this.adapter.lookupReadiness(request);
    const allowed = readiness.status === 'instantly_onboardable';

    return {
      allowed,
      reason: allowed
        ? readiness.reason || 'Mobility engine: instantly onboardable'
        : readiness.reason || `Mobility engine status ${readiness.status}`,
      readiness,
      source: 'adapter',
    };
  }

  private evaluateProfile(request: MobilityRequest): MobilityDecision | null {
    const profile = request.clinicianProfile;
    if (!profile?.mobility) {
      return null;
    }

    const { mobility } = profile;
    if (mobility.status !== 'instantly_onboardable') {
      return null;
    }

    if (mobility.supportedOrgIds && !mobility.supportedOrgIds.includes(request.targetOrgId)) {
      return null;
    }

    return {
      allowed: true,
      reason: 'Clinician mobility profile indicates instant onboarding',
      readiness: { status: 'instantly_onboardable' },
      source: 'profile',
    };
  }
}

export class InMemoryMobilityAdapter implements MobilityEngineAdapter {
  private readonly records: Map<string, Map<string, MobilityReadiness>> = new Map();

  constructor(seed?: Record<string, Record<string, MobilityReadiness>>) {
    if (seed) {
      for (const [clinicianId, targets] of Object.entries(seed)) {
        const targetMap = new Map<string, MobilityReadiness>();
        for (const [orgId, readiness] of Object.entries(targets)) {
          targetMap.set(orgId, readiness);
        }
        this.records.set(clinicianId, targetMap);
      }
    }
  }

  async lookupReadiness(request: MobilityRequest): Promise<MobilityReadiness> {
    const targetMap = this.records.get(request.clinicianId);
    if (!targetMap) {
      return {
        status: 'portable',
        readyInHours: 72,
        reason: 'Default portable readiness (not seeded).',
      };
    }

    const readiness = targetMap.get(request.targetOrgId);
    if (!readiness) {
      return {
        status: 'portable',
        readyInHours: 72,
        reason: `No explicit readiness for org ${request.targetOrgId}`,
      };
    }

    return readiness;
  }

  seed(clinicianId: string, targetOrgId: string, readiness: MobilityReadiness) {
    const targetMap = this.records.get(clinicianId) ?? new Map<string, MobilityReadiness>();
    targetMap.set(targetOrgId, readiness);
    this.records.set(clinicianId, targetMap);
  }
}
