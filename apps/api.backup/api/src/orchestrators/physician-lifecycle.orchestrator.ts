/**
 * Physician Lifecycle Orchestrator
 *
 * Encodes the full physician credentialing lifecycle:
 * 1. FCVS (Federation Credentials Verification Service)
 * 2. State Medical License
 * 3. NPI & DEA (with MATE training)
 * 4. Board Certification (ABMS or AOA)
 * 5. IMLC (Interstate Medical Licensure Compact)
 * 6. CAQH (Council for Affordable Quality Healthcare)
 * 7. PECOS (Provider Enrollment, Chain and Ownership System)
 *
 * Plus:
 * - JCAHO temporary privileges ≤ 120 days
 * - NPDB (National Practitioner Data Bank) queries
 * - OIG (Office of Inspector General) checks
 */

export type LifecycleStage =
  | 'FCVS'
  | 'STATE_LICENSE'
  | 'NPI'
  | 'DEA'
  | 'BOARD_CERT'
  | 'IMLC'
  | 'CAQH'
  | 'PECOS';

export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'expired';

export interface PhysicianLifecycleState {
  physicianId: string;
  stages: Map<LifecycleStage, StageRecord>;
  temporaryPrivileges?: TemporaryPrivilege[];
  npdbQueries: NPDBQuery[];
  oigChecks: OIGCheck[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StageRecord {
  stage: LifecycleStage;
  status: StageStatus;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  expirationDate?: Date;
  evidenceIds: string[];
  notes?: string;
}

export interface TemporaryPrivilege {
  id: string;
  facility: string;
  grantedDate: Date;
  expirationDate: Date; // Must be ≤ grantedDate + 120 days
  status: 'active' | 'expired' | 'revoked';
}

export interface NPDBQuery {
  id: string;
  queryDate: Date;
  result: 'clear' | 'reportable';
  reportIds?: string[];
}

export interface OIGCheck {
  id: string;
  checkDate: Date;
  result: 'clear' | 'excluded';
  exclusionDetails?: string;
}

export class PhysicianLifecycleOrchestrator {
  /**
   * Initialize lifecycle state for a new physician
   */
  async initializeLifecycle(physicianId: string): Promise<PhysicianLifecycleState> {
    const stages = new Map<LifecycleStage, StageRecord>();
    const stageOrder: LifecycleStage[] = [
      'FCVS',
      'STATE_LICENSE',
      'NPI',
      'DEA',
      'BOARD_CERT',
      'IMLC',
      'CAQH',
      'PECOS',
    ];

    for (const stage of stageOrder) {
      stages.set(stage, {
        stage,
        status: 'not_started',
        evidenceIds: [],
      });
    }

    const state: PhysicianLifecycleState = {
      physicianId,
      stages,
      npdbQueries: [],
      oigChecks: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // TODO: Persist to database
    return state;
  }

  /**
   * Advance a stage to the next status
   */
  async updateStage(
    physicianId: string,
    stage: LifecycleStage,
    status: StageStatus,
    evidenceId?: string
  ): Promise<void> {
    // TODO: Load lifecycle state from DB
    const state = await this.getLifecycleState(physicianId);
    const stageRecord = state.stages.get(stage);

    if (!stageRecord) {
      throw new Error(`Stage ${stage} not found for physician ${physicianId}`);
    }

    stageRecord.status = status;

    if (status === 'in_progress' && !stageRecord.startedAt) {
      stageRecord.startedAt = new Date();
    }

    if (status === 'completed') {
      stageRecord.completedAt = new Date();
    }

    if (status === 'failed') {
      stageRecord.failedAt = new Date();
    }

    if (evidenceId) {
      stageRecord.evidenceIds.push(evidenceId);
    }

    state.updatedAt = new Date();

    // TODO: Persist updated state
    console.log('Updated stage:', { physicianId, stage, status });
  }

  /**
   * Grant temporary privilege (JCAHO ≤ 120 days)
   */
  async grantTemporaryPrivilege(
    physicianId: string,
    facility: string,
    grantedDate: Date,
    durationDays: number
  ): Promise<TemporaryPrivilege> {
    if (durationDays > 120) {
      throw new Error(
        'JCAHO temporary privileges cannot exceed 120 days'
      );
    }

    const expirationDate = new Date(grantedDate);
    expirationDate.setDate(expirationDate.getDate() + durationDays);

    const privilege: TemporaryPrivilege = {
      id: this.generateId(),
      facility,
      grantedDate,
      expirationDate,
      status: 'active',
    };

    // TODO: Persist to database
    console.log('Granted temporary privilege:', privilege);
    return privilege;
  }

  /**
   * Record NPDB query
   */
  async recordNPDBQuery(
    physicianId: string,
    result: 'clear' | 'reportable',
    reportIds?: string[]
  ): Promise<NPDBQuery> {
    const query: NPDBQuery = {
      id: this.generateId(),
      queryDate: new Date(),
      result,
      reportIds,
    };

    // TODO: Persist and attach to lifecycle state
    console.log('Recorded NPDB query:', query);
    return query;
  }

  /**
   * Record OIG check
   */
  async recordOIGCheck(
    physicianId: string,
    result: 'clear' | 'excluded',
    exclusionDetails?: string
  ): Promise<OIGCheck> {
    const check: OIGCheck = {
      id: this.generateId(),
      checkDate: new Date(),
      result,
      exclusionDetails,
    };

    // TODO: Persist and attach to lifecycle state
    console.log('Recorded OIG check:', check);
    return check;
  }

  /**
   * Get lifecycle state for a physician
   */
  private async getLifecycleState(
    physicianId: string
  ): Promise<PhysicianLifecycleState> {
    // TODO: Database query
    throw new Error('Not implemented');
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get lifecycle progress summary
   */
  async getProgress(physicianId: string): Promise<{
    completed: number;
    total: number;
    currentStage?: LifecycleStage;
    blockers?: string[];
  }> {
    const state = await this.getLifecycleState(physicianId);
    const stages = Array.from(state.stages.values());

    const completed = stages.filter((s) => s.status === 'completed').length;
    const total = stages.length;

    const currentStage = stages.find(
      (s) => s.status === 'in_progress'
    )?.stage;

    const blockers = stages
      .filter((s) => s.status === 'failed')
      .map((s) => `${s.stage}: ${s.notes || 'Failed'}`);

    return {
      completed,
      total,
      currentStage,
      blockers: blockers.length > 0 ? blockers : undefined,
    };
  }
}

export const physicianLifecycleOrchestrator = new PhysicianLifecycleOrchestrator();

