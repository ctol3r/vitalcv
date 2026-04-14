/**
 * Drift Engine
 *
 * Defines how VitalCV detects when a clinician's state has drifted from a
 * previously valid state (Recognition, Acceptance, or Start).
 */

export enum DriftSeverity {
  /** Trust Broken: OIG Exclusion, License Revoked, NPI Deactivated */
  HARD_DRIFT = 'HARD_DRIFT',
  /** Trust Degraded: Stale data, minor demographic mismatch */
  SOFT_DRIFT = 'SOFT_DRIFT',
}

export type DriftSourceType = 
  | 'NPPES' 
  | 'OIG_LEIE' 
  | 'PECOS' 
  | 'STATE_LICENSE' 
  | 'TEMPORAL';

export interface DriftEvent {
  severity: DriftSeverity;
  source: DriftSourceType;
  description: string;
  detectedAt: Date;
}

export interface MonitoringPlan {
  clinicianNpi: string;
  /** Primary sources that must be continuously verified */
  sourcesToWatch: DriftSourceType[];
  /** Maximum age of data before SOFT_DRIFT is triggered */
  refreshCadenceDays: number;
  /** Dictates alerting and grace periods */
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export enum DriftEventType {
  DRIFT_DETECTED = 'DRIFT_DETECTED',
  HARD_DRIFT_TRIGGERED = 'HARD_DRIFT_TRIGGERED',
  SOFT_DRIFT_TRIGGERED = 'SOFT_DRIFT_TRIGGERED',
  ACTIVATION_INVALIDATED = 'ACTIVATION_INVALIDATED',
}

export interface SystemDriftEvent {
  clinicianNpi: string;
  eventType: DriftEventType;
  severity: DriftSeverity;
  source: DriftSourceType;
  detectedAt: Date;
}

export class DriftReactionHandler {
  /**
   * Routes a verified drift event to the appropriate system reaction.
   * FLOW: driftEngine -> event -> handler -> system update
   */
  static async handleEvent(event: SystemDriftEvent): Promise<void> {
    if (event.severity === DriftSeverity.HARD_DRIFT) {
      await this.handleHardDrift(event);
    } else {
      await this.handleSoftDrift(event);
    }
  }

  private static async handleHardDrift(event: SystemDriftEvent): Promise<void> {
    // REACTION:
    // 1. Invalidate ACTIVE StartActivation -> NOT_STARTABLE
    // 2. Flag clinician profile (EmployerAcceptance status update or anomaly record)
    // 3. Require re-verification (emit ACTIVATION_INVALIDATED)
    console.log(`[Drift Handler] HARD DRIFT for ${event.clinicianNpi} from ${event.source}. Invalidating activation.`);
  }

  private static async handleSoftDrift(event: SystemDriftEvent): Promise<void> {
    // REACTION:
    // 1. Mark as stale (tag Recognition cache)
    // 2. Schedule background refresh
    console.log(`[Drift Handler] SOFT DRIFT for ${event.clinicianNpi}. Scheduling refresh.`);
  }
}

export class DriftEngine {
  /**
   * Generates a default monitoring plan for a clinician based on their role and organization.
   */
  static createMonitoringPlan(npi: string, role: string = 'CLINICIAN'): MonitoringPlan {
    return {
      clinicianNpi: npi,
      sourcesToWatch: ['NPPES', 'OIG_LEIE'],
      refreshCadenceDays: 30, // Default NCQA / standard compliance cadence
      riskLevel: role === 'MEDICAL_DIRECTOR' ? 'HIGH' : 'LOW',
    };
  }

  /**
   * Stub for evaluating drift against a given Recognition state and Monitoring Plan.
   * Future implementation will trigger HARD_DRIFT / SOFT_DRIFT events based on real data.
   */
  static evaluateDrift(
    recognitionSnapshot: Record<string, unknown>,
    plan: MonitoringPlan
  ): DriftEvent[] {
    const detectedDrift: DriftEvent[] = [];
    
    // TODO: Compare current recognition state age against plan.refreshCadenceDays
    // TODO: Detect explicit revocation flags in recognitionSnapshot

    return detectedDrift;
  }
}
