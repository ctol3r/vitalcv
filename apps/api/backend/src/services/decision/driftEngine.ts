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

export enum NotificationUrgency {
  LOG_ONLY = 'LOG_ONLY',
  LOW = 'LOW',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface HumanNotification {
  id: string;
  clinicianNpi: string;
  eventType: DriftEventType;
  severity: DriftSeverity;
  urgency: NotificationUrgency;
  message: string;
  createdAt: Date;
}

export enum HumanAction {
  ACKNOWLEDGE = 'ACKNOWLEDGE',
  RERUN_VERIFICATION = 'RERUN_VERIFICATION',
  REVIEW_PROFILE = 'REVIEW_PROFILE',
}

export class NotificationEngine {
  /**
   * Translates a raw system event into a human-readable notification structure.
   */
  static generateNotification(event: SystemDriftEvent): HumanNotification {
    let urgency = NotificationUrgency.LOG_ONLY;
    let message = `System drift detected for NPI ${event.clinicianNpi}.`;

    switch (event.eventType) {
      case DriftEventType.DRIFT_DETECTED:
        urgency = NotificationUrgency.LOG_ONLY;
        message = `Drift observation logged for ${event.clinicianNpi}.`;
        break;
      case DriftEventType.SOFT_DRIFT_TRIGGERED:
        urgency = NotificationUrgency.LOW;
        message = `Data for NPI ${event.clinicianNpi} is stale (${event.source}). A background refresh is scheduled.`;
        break;
      case DriftEventType.HARD_DRIFT_TRIGGERED:
        urgency = NotificationUrgency.HIGH;
        message = `Critical anomaly detected for NPI ${event.clinicianNpi} from ${event.source}. Profile flagged.`;
        break;
      case DriftEventType.ACTIVATION_INVALIDATED:
        urgency = NotificationUrgency.CRITICAL;
        message = `URGENT: Start Activation invalidated for NPI ${event.clinicianNpi} due to Hard Drift. Immediate review required.`;
        break;
    }

    return {
      id: crypto.randomUUID(),
      clinicianNpi: event.clinicianNpi,
      eventType: event.eventType,
      severity: event.severity,
      urgency,
      message,
      createdAt: new Date(),
    };
  }

  /**
   * Routes the notification to configured delivery channels (UI Panel, In-App Alert).
   */
  static async deliver(notification: HumanNotification): Promise<void> {
    if (notification.urgency === NotificationUrgency.LOG_ONLY) {
      console.log(`[Notification Engine - LOG] ${notification.message}`);
      return;
    }
    
    // TODO: Persist to UI Notification Panel DB table
    console.log(`[Notification Engine - ${notification.urgency}] ${notification.message}`);
  }
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

    // Translate to Human Notification
    const notification = NotificationEngine.generateNotification(event);
    await NotificationEngine.deliver(notification);
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
