import { Prisma, PrismaClient, CredentialLifecycle } from '@prisma/client';
import { LifecycleAuditLog } from './audit';

export type LifecyclePhase =
  | 'intake'
  | 'psv'
  | 'issued'
  | 'active'
  | 'expiring'
  | 'expired'
  | 'retired';

export interface LifecycleSignals {
  verificationCompletedAt?: string | Date | null;
  issuedAt?: string | Date | null;
  activatedAt?: string | Date | null;
  expiresAt?: string | Date | null;
  retiredAt?: string | Date | null;
  retiresExplicitly?: boolean;
  status?: 'pending' | 'active' | 'expiring' | 'expired' | 'retired' | 'revoked';
}

export interface LifecycleRecommendation {
  phase: LifecyclePhase;
  confidence: number;
  reasons: string[];
  window?: {
    start: string;
    end: string;
  };
}

export interface LifecycleTransitionInput {
  credentialId: string;
  nextPhase: LifecyclePhase;
  metadata?: Record<string, any>;
  reason?: string;
  triggeredBy?: string;
  timestamp?: Date;
  allowRegression?: boolean;
  allowSkipForward?: boolean;
}

export interface LifecycleTransitionResult {
  record: CredentialLifecycle;
  previousPhase?: LifecyclePhase;
  changed: boolean;
}

const LIFECYCLE_SEQUENCE: LifecyclePhase[] = [
  'intake',
  'psv',
  'issued',
  'active',
  'expiring',
  'expired',
  'retired',
];

const PHASE_INDEX = LIFECYCLE_SEQUENCE.reduce<Record<LifecyclePhase, number>>((acc, phase, idx) => {
  acc[phase] = idx;
  return acc;
}, {} as Record<LifecyclePhase, number>);

const ALLOWED_TRANSITIONS: Record<LifecyclePhase, LifecyclePhase[]> = {
  intake: ['psv', 'issued'],
  psv: ['issued', 'active'],
  issued: ['active'],
  active: ['expiring', 'expired', 'retired'],
  expiring: ['expired', 'active'],
  expired: ['retired', 'active'],
  retired: [],
};

const prisma = new PrismaClient();

export class LifecycleTransitionEngine {
  private readonly auditLog: LifecycleAuditLog;

  constructor(private readonly db: PrismaClient = prisma, auditLog?: LifecycleAuditLog) {
    this.auditLog = auditLog ?? new LifecycleAuditLog(db);
  }

  static allowedTransitions(): Record<LifecyclePhase, LifecyclePhase[]> {
    return ALLOWED_TRANSITIONS;
  }

  static phaseOrder(): LifecyclePhase[] {
    return [...LIFECYCLE_SEQUENCE];
  }

  async getCurrentRecord(credentialId: string): Promise<CredentialLifecycle | null> {
    return this.db.credentialLifecycle.findFirst({
      where: { credentialId },
      orderBy: { timestamp: 'desc' },
    });
  }

  async getHistory(credentialId: string, limit = 25): Promise<CredentialLifecycle[]> {
    return this.db.credentialLifecycle.findMany({
      where: { credentialId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async recordTransition(input: LifecycleTransitionInput): Promise<LifecycleTransitionResult> {
    const current = await this.getCurrentRecord(input.credentialId);

    if (current?.phase === input.nextPhase) {
      return { record: current, previousPhase: current.phase, changed: false };
    }

    if (
      !this.canTransition(current?.phase, input.nextPhase, {
        allowRegression: input.allowRegression,
        allowSkipForward: input.allowSkipForward,
      })
    ) {
      throw new Error(
        `Invalid lifecycle transition from ${current?.phase ?? 'none'} to ${input.nextPhase}`,
      );
    }

    const metadata = {
      ...(input.metadata ?? {}),
      reason: input.reason ?? input.metadata?.reason,
      triggeredBy: input.triggeredBy ?? input.metadata?.triggeredBy,
      previousPhase: current?.phase ?? null,
      transitionType: this.deriveTransitionType(current?.phase, input.nextPhase),
    } as Prisma.InputJsonValue;

    const record = await this.db.credentialLifecycle.create({
      data: {
        credentialId: input.credentialId,
        phase: input.nextPhase,
        metadata,
        timestamp: input.timestamp ?? new Date(),
      },
    });

    await this.auditLog.recordTransition(record, {
      previousPhase: current?.phase as LifecyclePhase | undefined,
    });

    return {
      record,
      previousPhase: current?.phase,
      changed: true,
    };
  }

  async ensurePhase(
    credentialId: string,
    nextPhase: LifecyclePhase,
    options: Omit<LifecycleTransitionInput, 'credentialId' | 'nextPhase'> = {},
  ): Promise<LifecycleTransitionResult> {
    const current = await this.getCurrentRecord(credentialId);

    if (current?.phase === nextPhase) {
      return { record: current, previousPhase: current.phase, changed: false };
    }

    return this.recordTransition({
      credentialId,
      nextPhase,
      ...options,
    });
  }

  recommendPhase(signals: LifecycleSignals, now: Date = new Date()): LifecycleRecommendation {
    const reasons: string[] = [];
    const normalizeDate = (value?: string | Date | null) =>
      value ? new Date(value).toISOString() : undefined;

    if (signals.retiredAt || signals.retiresExplicitly || signals.status === 'retired') {
      reasons.push('Retirement flag present.');
      return {
        phase: 'retired',
        confidence: 0.95,
        reasons,
      };
    }

    const expiresAt = signals.expiresAt ? new Date(signals.expiresAt) : undefined;
    if (signals.status === 'expired' || (expiresAt && expiresAt.getTime() < now.getTime())) {
      reasons.push('Credential expiration date is in the past.');
      return {
        phase: 'expired',
        confidence: 0.92,
        reasons,
      };
    }

    if (expiresAt) {
      const msUntilExpiry = expiresAt.getTime() - now.getTime();
      const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

      if (daysUntilExpiry <= 45) {
        reasons.push(`Credential expires in ${Math.round(daysUntilExpiry)} days.`);
        return {
          phase: 'expiring',
          confidence: 0.88,
          reasons,
          window: {
            start: now.toISOString(),
            end: normalizeDate(expiresAt)!,
          },
        };
      }
    }

    if (signals.activatedAt || signals.status === 'active') {
      reasons.push('Activation signal detected.');
      return {
        phase: 'active',
        confidence: 0.85,
        reasons,
      };
    }

    if (signals.issuedAt) {
      reasons.push('Credential issuance timestamp available.');
      return {
        phase: 'issued',
        confidence: 0.8,
        reasons,
      };
    }

    if (signals.verificationCompletedAt) {
      reasons.push('Primary source verification completed.');
      return {
        phase: 'psv',
        confidence: 0.75,
        reasons,
      };
    }

    reasons.push('Defaulting to intake phase.');
    return {
      phase: 'intake',
      confidence: 0.5,
      reasons,
    };
  }

  buildTransitionPath(from: LifecyclePhase, to: LifecyclePhase): LifecyclePhase[] {
    if (from === to) {
      return [to];
    }

    const fromIndex = PHASE_INDEX[from];
    const toIndex = PHASE_INDEX[to];
    const step = fromIndex <= toIndex ? 1 : -1;
    const path: LifecyclePhase[] = [];

    for (let idx = fromIndex + step; step > 0 ? idx <= toIndex : idx >= toIndex; idx += step) {
      path.push(LIFECYCLE_SEQUENCE[idx]);
    }

    return path;
  }

  private canTransition(
    from: LifecyclePhase | undefined,
    to: LifecyclePhase,
    options: { allowRegression?: boolean; allowSkipForward?: boolean } = {},
  ): boolean {
    if (!from) {
      return true;
    }

    if (from === to) {
      return true;
    }

    if (ALLOWED_TRANSITIONS[from]?.includes(to)) {
      return true;
    }

    const fromIndex = PHASE_INDEX[from];
    const toIndex = PHASE_INDEX[to];

    if (options.allowSkipForward && toIndex > fromIndex) {
      return true;
    }

    if (options.allowRegression && toIndex <= fromIndex) {
      return true;
    }

    return false;
  }

  private deriveTransitionType(
    from: LifecyclePhase | undefined,
    to: LifecyclePhase,
  ): 'forward' | 'regression' | 'repeat' | 'init' {
    if (!from) {
      return 'init';
    }
    if (from === to) {
      return 'repeat';
    }
    return PHASE_INDEX[to] >= PHASE_INDEX[from] ? 'forward' : 'regression';
  }
}


