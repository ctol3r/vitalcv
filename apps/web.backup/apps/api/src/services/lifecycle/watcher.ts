import type { PrismaClient, WalletCredential, Prisma } from '@prisma/client';
import { PrismaClient as PrismaDelegate } from '@prisma/client';
import {
  LifecycleTransitionEngine,
  type LifecycleRecommendation,
  type LifecycleSignals,
  type LifecyclePhase,
} from './transition';

const prisma = new PrismaDelegate();
const DAY_IN_MS = 1000 * 60 * 60 * 24;
const MANAGED_TYPE_FILTERS: Prisma.WalletCredentialWhereInput[] = [
  { type: { contains: 'License', mode: 'insensitive' } },
  { type: { contains: 'CME', mode: 'insensitive' } },
  { type: { contains: 'Board', mode: 'insensitive' } },
];

export type LifecycleWatchType =
  | 'license_expiring'
  | 'license_expired'
  | 'cme_due'
  | 'cme_overdue'
  | 'board_recert_window'
  | 'board_recert_overdue';

export type LifecycleWatchSeverity = 'informational' | 'warning' | 'critical';

export interface LifecycleWatchFinding {
  credentialId: string;
  clinicianId: string;
  type: LifecycleWatchType;
  status: LifecycleWatchSeverity;
  occursAt: string;
  metadata: Record<string, unknown>;
}

export interface LifecycleWatcherOptions {
  clinicianId?: string;
  credentialIds?: string[];
  limit?: number;
  now?: Date;
}

interface CredentialEvaluation {
  signals: LifecycleSignals;
  findings: LifecycleWatchFinding[];
  recommendation?: LifecycleRecommendation;
}

export class LifecycleWatcher {
  private readonly engine: LifecycleTransitionEngine;

  constructor(private readonly db: PrismaClient = prisma, engine?: LifecycleTransitionEngine) {
    this.engine = engine ?? new LifecycleTransitionEngine(db);
  }

  async run(options: LifecycleWatcherOptions = {}): Promise<LifecycleWatchFinding[]> {
    const now = options.now ?? new Date();
    const credentials = await this.loadCredentials(options);
    const findings: LifecycleWatchFinding[] = [];

    for (const credential of credentials) {
      const evaluation = this.evaluateCredential(credential, now);
      findings.push(...evaluation.findings);

      if (evaluation.recommendation && this.shouldApplyPhase(evaluation.recommendation.phase)) {
        await this.engine.ensurePhase(credential.credentialId, evaluation.recommendation.phase, {
          reason: 'watcher_detected_signal',
          metadata: {
            source: 'lifecycle_watcher',
            findings: evaluation.findings.map((finding) => ({
              type: finding.type,
              status: finding.status,
              occursAt: finding.occursAt,
            })),
            signals: evaluation.signals,
          },
        });
      }
    }

    return findings;
  }

  private async loadCredentials(options: LifecycleWatcherOptions): Promise<WalletCredential[]> {
    const where: Prisma.WalletCredentialWhereInput = {};

    if (options.clinicianId) {
      where.clinicianId = options.clinicianId;
    }

    if (options.credentialIds?.length) {
      where.credentialId = { in: options.credentialIds };
    } else {
      where.OR = MANAGED_TYPE_FILTERS;
    }

    return this.db.walletCredential.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: options.limit ?? 250,
    });
  }

  private evaluateCredential(credential: WalletCredential, now: Date): CredentialEvaluation {
    const subject = extractCredentialSubject(credential.payload);

    const license = extractLicenseInfo(subject);
    const cme = extractCmeInfo(subject);
    const board = extractBoardInfo(subject);

    const findings: LifecycleWatchFinding[] = [];
    const signals: LifecycleSignals = {
      verificationCompletedAt: license?.verifiedAt ?? undefined,
      issuedAt: credential.issuedAt,
      activatedAt: license?.status === 'active' ? credential.updatedAt ?? credential.issuedAt : undefined,
      retiresExplicitly: license?.status === 'retired',
      expiresAt: undefined,
      status: deriveLifecycleStatus(license),
    };

    const dueDates = [
      license?.expiry,
      cme?.dueBy,
      board?.recertDue,
    ].filter((value): value is Date => Boolean(value));
    const earliestDue = dueDates.length
      ? new Date(Math.min(...dueDates.map((date) => date.getTime())))
      : undefined;
    if (earliestDue) {
      signals.expiresAt = earliestDue.toISOString();
    }

    if (license?.expiry) {
      const daysRemaining = diffInDays(license.expiry, now);
      if (daysRemaining < 0) {
        findings.push(
          buildFinding(credential, 'license_expired', 'critical', license.expiry, {
            daysOverdue: Math.abs(daysRemaining),
            state: license.state,
            licenseNumber: license.number,
          }),
        );
      } else if (daysRemaining <= 45) {
        findings.push(
          buildFinding(credential, 'license_expiring', 'warning', license.expiry, {
            daysRemaining,
            state: license.state,
            licenseNumber: license.number,
          }),
        );
      }
    }

    if (cme?.dueBy) {
      const daysRemaining = diffInDays(cme.dueBy, now);
      const hoursRemaining =
        typeof cme.required === 'number' && typeof cme.completed === 'number'
          ? Math.max(0, cme.required - cme.completed)
          : undefined;

      if (daysRemaining < 0 || (hoursRemaining && hoursRemaining > 0 && daysRemaining < 0)) {
        findings.push(
          buildFinding(credential, 'cme_overdue', 'critical', cme.dueBy, {
            daysOverdue: Math.abs(daysRemaining),
            hoursRemaining,
            category: cme.category,
          }),
        );
      } else if (daysRemaining <= 30 || (hoursRemaining && hoursRemaining > 0)) {
        findings.push(
          buildFinding(credential, 'cme_due', 'warning', cme.dueBy, {
            daysRemaining,
            hoursRemaining,
            category: cme.category,
          }),
        );
      }
    }

    if (board?.recertDue) {
      const daysRemaining = diffInDays(board.recertDue, now);
      if (daysRemaining < 0) {
        findings.push(
          buildFinding(credential, 'board_recert_overdue', 'critical', board.recertDue, {
            board: board.boardName,
            daysOverdue: Math.abs(daysRemaining),
          }),
        );
      } else if (daysRemaining <= 90) {
        findings.push(
          buildFinding(credential, 'board_recert_window', 'warning', board.recertDue, {
            board: board.boardName,
            daysRemaining,
          }),
        );
      }
    }

    let recommendation: LifecycleRecommendation | undefined;
    if (license?.status || license?.expiry) {
      recommendation = this.engine.recommendPhase(signals, now);
    }

    return {
      findings,
      signals,
      recommendation,
    };
  }

  private shouldApplyPhase(phase: LifecyclePhase): boolean {
    return phase === 'active' || phase === 'expiring' || phase === 'expired' || phase === 'retired';
  }
}

interface LicenseInfo {
  number?: string;
  state?: string;
  status?: string;
  expiry?: Date;
  verifiedAt?: string;
}

interface CmeInfo {
  dueBy?: Date;
  completed?: number;
  required?: number;
  category?: string;
}

interface BoardInfo {
  recertDue?: Date;
  boardName?: string;
  status?: string;
}

function buildFinding(
  credential: WalletCredential,
  type: LifecycleWatchType,
  status: LifecycleWatchSeverity,
  occursAt: Date,
  metadata: Record<string, unknown>,
): LifecycleWatchFinding {
  return {
    credentialId: credential.credentialId,
    clinicianId: credential.clinicianId,
    type,
    status,
    occursAt: occursAt.toISOString(),
    metadata,
  };
}

function diffInDays(target: Date, now: Date): number {
  return Math.round((target.getTime() - now.getTime()) / DAY_IN_MS);
}

function deriveLifecycleStatus(license?: LicenseInfo | null): LifecycleSignals['status'] {
  if (!license?.status) {
    return undefined;
  }
  const normalized = license.status.toLowerCase();
  if (normalized.includes('expire')) {
    return 'expired';
  }
  if (normalized.includes('retire')) {
    return 'retired';
  }
  if (normalized.includes('active') || normalized.includes('good')) {
    return 'active';
  }
  return undefined;
}

function extractCredentialSubject(payload: Prisma.JsonValue | null): Record<string, any> {
  const root = toRecord(payload);
  if (!root) {
    return {};
  }

  const claims = toRecord(root.claims) ?? root;
  return (
    toRecord(claims.credentialSubject) ??
    toRecord(root.credentialSubject) ??
    toRecord(root.subject) ??
    claims
  );
}

function extractLicenseInfo(subject: Record<string, any>): LicenseInfo | null {
  const license =
    toRecord(subject.license) ??
    (Array.isArray(subject.licenses) ? toRecord(subject.licenses[0]) : null) ??
    toRecord(subject.primaryLicense) ??
    null;

  if (!license) {
    return null;
  }

  const expiry =
    parseDate(license.expires) ??
    parseDate(license.expiryDate) ??
    parseDate(license.expiration) ??
    parseDate(license.expirationDate) ??
    parseDate(license.validThrough);

  return {
    number: pickString(license.number) ?? pickString(license.licenseNumber),
    state: pickString(license.state) ?? pickString(license.jurisdiction),
    status: pickString(license.status),
    expiry: expiry ?? undefined,
    verifiedAt: pickString(license.verifiedAt) ?? pickString(license.psvCompletedAt),
  };
}

function extractCmeInfo(subject: Record<string, any>): CmeInfo | null {
  const cme =
    toRecord(subject.cme) ??
    toRecord(subject.cmeRequirement) ??
    toRecord(subject.cmeSummary) ??
    null;

  if (!cme) {
    return null;
  }

  const dueBy =
    parseDate(cme.dueBy) ??
    parseDate(cme.nextDue) ??
    parseDate(cme.renewalDue) ??
    parseDate(cme.attestationDue) ??
    parseDate(cme.dueDate);

  const required = toNumber(cme.required ?? cme.hoursRequired ?? cme.minimumHours);
  const completed = toNumber(cme.completed ?? cme.hoursCompleted ?? cme.totalHours);

  if (!dueBy && required === undefined) {
    return null;
  }

  return {
    dueBy: dueBy ?? undefined,
    required,
    completed,
    category: pickString(cme.category),
  };
}

function extractBoardInfo(subject: Record<string, any>): BoardInfo | null {
  const board =
    toRecord(subject.board) ??
    (Array.isArray(subject.boards) ? toRecord(subject.boards[0]) : null) ??
    toRecord(subject.boardCertification) ??
    null;

  if (!board) {
    return null;
  }

  const recertDue =
    parseDate(board.recertDue) ??
    parseDate(board.recertificationDue) ??
    parseDate(board.expiresAt) ??
    parseDate(board.validThrough);

  if (!recertDue) {
    return null;
  }

  return {
    recertDue,
    boardName: pickString(board.board) ?? pickString(board.primary) ?? pickString(board.name),
    status: pickString(board.status),
  };
}

function parseDate(value: unknown): Date | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function toRecord(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, any>;
}


