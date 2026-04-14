import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

const PILOT_EVENT_AUDIT_TYPE = 'PILOT_OPS_EVENT';
const PILOT_QUEUE_ITEM_AUDIT_TYPE = 'PILOT_OPS_QUEUE_ITEM';
const PILOT_QUEUE_UPDATE_AUDIT_TYPE = 'PILOT_OPS_QUEUE_UPDATE';
const PILOT_SURFACE_CONTROL_AUDIT_TYPE = 'PILOT_OPS_SURFACE_CONTROL';
const LOOKBACK_DAYS = 30;

export const PILOT_METRIC_EVENT_TYPES = [
  'sign_in',
  'onboarding_started',
  'onboarding_completed',
  'npi_submitted',
  'readiness_viewed',
  'blocker_opened',
  'blocker_resolved',
  'opportunity_viewed',
  'apply_started',
  'apply_submitted',
  'application_detail_viewed',
  'application_status_viewed',
  'alert_viewed',
  'wallet_viewed',
  'return_session',
  'feedback_submitted',
  'support_triggered',
  'auth_failure',
  'route_failure',
  'employer_action_taken',
  'passport_viewed',
  'review_requested',
  'review_opened',
] as const;

export const PILOT_QUEUE_STATUSES = [
  'NEW',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'KNOWN_ISSUE',
  'HOTFIX_QUEUED',
  'MITIGATED',
  'RESOLVED',
] as const;

export type PilotMetricEventType = (typeof PILOT_METRIC_EVENT_TYPES)[number];
export type PilotQueueStatus = (typeof PILOT_QUEUE_STATUSES)[number];
export type PilotSeverity = 'low' | 'medium' | 'high' | 'critical';
export type PilotQueueSource =
  | 'feedback'
  | 'support'
  | 'auth'
  | 'route_failure'
  | 'system_failure'
  | 'metric'
  | 'runtime'
  | 'manual';
export type PilotSurfaceMode = 'enabled' | 'degraded' | 'disabled' | 'hidden';

const PILOT_SURFACE_DEFINITIONS = [
  {
    surfaceId: 'explore_board',
    label: 'Explore board',
    affectsRoutes: ['/explore', '/api/opportunities'],
  },
  {
    surfaceId: 'apply_flow',
    label: 'Apply flow',
    affectsRoutes: ['/explore?apply=', '/api/opportunities/:id/apply'],
  },
  {
    surfaceId: 'onboarding_flow',
    label: 'Onboarding flow',
    affectsRoutes: ['/onboarding'],
  },
] as const;

export interface PilotEntityContext {
  kind?: string | null;
  id?: string | null;
  label?: string | null;
  objectType?: string | null;
}

export interface PilotOpsActorContext {
  userId?: string | null;
  email?: string | null;
  role?: string | null;
  organizationId?: string | null;
}

export interface RecordPilotMetricInput extends PilotOpsActorContext {
  eventType: PilotMetricEventType;
  route: string;
  message?: string | null;
  severity?: PilotSeverity | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
  queueItem?: {
    source: PilotQueueSource;
    title: string;
    message: string;
    severity?: PilotSeverity | null;
    blocking?: boolean;
  } | null;
}

export interface SubmitPilotFeedbackInput extends PilotOpsActorContext {
  kind: 'feedback' | 'issue' | 'support';
  type: 'nps' | 'bug' | 'feature';
  route: string;
  message?: string | null;
  email?: string | null;
  score?: number | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
}

export interface UpdatePilotQueueItemInput extends PilotOpsActorContext {
  itemId: string;
  status: PilotQueueStatus;
  owner?: string | null;
  note?: string | null;
}

export interface CreatePilotQueueItemInput extends PilotOpsActorContext {
  source: PilotQueueSource;
  title: string;
  message: string;
  severity?: PilotSeverity | null;
  route: string;
  owner?: string | null;
  status?: PilotQueueStatus | null;
  entity?: PilotEntityContext | null;
  details?: Record<string, unknown> | null;
  blocking?: boolean;
}

export interface SetPilotSurfaceControlInput extends PilotOpsActorContext {
  surfaceId: string;
  mode: PilotSurfaceMode;
  reason?: string | null;
}

export interface PilotOpsMetrics {
  signIns: number;
  onboardingStarted: number;
  onboardingCompleted: number;
  readinessViewed: number;
  passportViewed: number;
  reviewRequested: number;
  reviewOpened: number;
  blockerOpened: number;
  blockerResolved: number;
  opportunityViewed: number;
  applyStarted: number;
  applySubmitted: number;
  applicationDetailViewed: number;
  applicationStatusViewed: number;
  alertViewed: number;
  walletViewed: number;
  returnSession: number;
  feedbackSubmitted: number;
  supportTriggered: number;
  authFailures: number;
  routeFailures: number;
  openQueueItems: number;
  criticalQueueItems: number;
}

export interface PilotQueueItem {
  id: string;
  source: PilotQueueSource;
  title: string;
  message: string;
  severity: PilotSeverity;
  route: string | null;
  role: string | null;
  status: PilotQueueStatus;
  owner: string | null;
  createdAt: string;
  updatedAt: string;
  eventType: PilotMetricEventType | null;
  blocking: boolean;
  entity: PilotEntityContext | null;
  email: string | null;
  feedbackId: string | null;
  details: Record<string, unknown> | null;
  lastAction: PilotQueueAction | null;
}

export interface PilotQueueAction {
  status: PilotQueueStatus;
  owner: string | null;
  note: string | null;
  actorId: string | null;
  updatedAt: string;
}

export interface PilotSurfaceControl {
  surfaceId: string;
  label: string;
  affectsRoutes: string[];
  mode: PilotSurfaceMode;
  reason: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface PilotBaselineSnapshot {
  providerCount: number;
  findingsCount: number;
  storylineCount: number;
  opportunitiesCount: number;
  graphNodeCount: number;
  graphEdgeCount: number;
  activeApplications: number;
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
}

export interface PilotOpsSummary {
  generatedAt: string;
  metrics: PilotOpsMetrics;
  queue: PilotQueueItem[];
  baseline: PilotBaselineSnapshot;
  surfaceControls: PilotSurfaceControl[];
}

type AuditRow = {
  id: string;
  type: string;
  referenceId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
};

type QueueOverlay = {
  status: PilotQueueStatus;
  owner: string | null;
  note: string | null;
  actorId: string | null;
  updatedAt: string;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function readRecord(value: Prisma.JsonValue | null | undefined): Record<string, Prisma.JsonValue> {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return {};
  }

  return value as Record<string, Prisma.JsonValue>;
}

function readObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
  const record = readRecord(value);
  return Object.keys(record).length > 0 ? (record as Record<string, unknown>) : null;
}

function readString(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readBoolean(value: Prisma.JsonValue | undefined): boolean {
  return value === true;
}

function normalizeSeverity(value: string | null | undefined): PilotSeverity {
  switch (value?.toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'medium';
  }
}

function normalizeQueueStatus(value: string | null | undefined): PilotQueueStatus {
  switch (value?.toUpperCase()) {
    case 'ACKNOWLEDGED':
      return 'ACKNOWLEDGED';
    case 'INVESTIGATING':
      return 'INVESTIGATING';
    case 'KNOWN_ISSUE':
      return 'KNOWN_ISSUE';
    case 'HOTFIX_QUEUED':
      return 'HOTFIX_QUEUED';
    case 'MITIGATED':
      return 'MITIGATED';
    case 'RESOLVED':
      return 'RESOLVED';
    default:
      return 'NEW';
  }
}

function normalizeQueueSource(value: string | null | undefined): PilotQueueSource {
  switch (value) {
    case 'support':
    case 'auth':
    case 'route_failure':
    case 'system_failure':
    case 'metric':
    case 'runtime':
    case 'manual':
      return value;
    default:
      return 'feedback';
  }
}

function normalizeSurfaceMode(value: string | null | undefined): PilotSurfaceMode {
  switch (value?.toLowerCase()) {
    case 'degraded':
      return 'degraded';
    case 'disabled':
      return 'disabled';
    case 'hidden':
      return 'hidden';
    default:
      return 'enabled';
  }
}

function readEntity(metadata: Record<string, Prisma.JsonValue>): PilotEntityContext | null {
  const entity = readRecord(metadata.entity);
  if (Object.keys(entity).length === 0) {
    return null;
  }

  return {
    kind: readString(entity.kind),
    id: readString(entity.id),
    label: readString(entity.label),
    objectType: readString(entity.objectType),
  };
}

function metricEventCount(rows: readonly AuditRow[], eventType: PilotMetricEventType): number {
  return rows.reduce((total, row) => {
    const metadata = readRecord(row.metadata);
    return readString(metadata.eventType) === eventType ? total + 1 : total;
  }, 0);
}

async function writeAuditEvent(input: {
  type: string;
  referenceId?: string | null;
  organizationId?: string | null;
  metadata: Record<string, unknown>;
}): Promise<AuditRow> {
  const metadata = toJsonValue(input.metadata);
  const serialized = JSON.stringify({
    type: input.type,
    referenceId: input.referenceId ?? null,
    organizationId: input.organizationId ?? null,
    metadata,
  });

  const row = await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash: sha256Hex(serialized),
      referenceId: input.referenceId ?? null,
      organizationId: input.organizationId ?? null,
      metadata,
    },
    select: {
      id: true,
      type: true,
      referenceId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return row;
}

async function createQueueItem(input: {
  source: PilotQueueSource;
  title: string;
  message: string;
  severity: PilotSeverity;
  route: string;
  owner?: string | null;
  status?: PilotQueueStatus | null;
  role?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  email?: string | null;
  entity?: PilotEntityContext | null;
  eventType?: PilotMetricEventType | null;
  feedbackId?: string | null;
  details?: Record<string, unknown> | null;
  blocking?: boolean;
}): Promise<PilotQueueItem> {
  const created = await writeAuditEvent({
    type: PILOT_QUEUE_ITEM_AUDIT_TYPE,
    organizationId: input.organizationId ?? null,
    metadata: {
      source: input.source,
      title: input.title,
      message: input.message,
      severity: input.severity,
      route: input.route,
      role: input.role ?? null,
      status: input.status ?? 'NEW',
      owner: input.owner ?? null,
      blocking: input.blocking === true,
      eventType: input.eventType ?? null,
      feedbackId: input.feedbackId ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,
      entity: input.entity ?? null,
      details: input.details ?? null,
    },
  });

  if (input.blocking === true) {
    await writeAuditEvent({
      type: PILOT_EVENT_AUDIT_TYPE,
      organizationId: input.organizationId ?? null,
      metadata: {
        eventType: 'blocker_opened',
        route: input.route,
        role: input.role ?? null,
        severity: input.severity,
        queueItemId: created.id,
        source: input.source,
        entity: input.entity ?? null,
      },
    });
  }

  return {
    id: created.id,
    source: input.source,
    title: input.title,
    message: input.message,
    severity: input.severity,
    route: input.route,
    role: input.role ?? null,
    status: input.status ?? 'NEW',
    owner: input.owner ?? null,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.createdAt.toISOString(),
    eventType: input.eventType ?? null,
    blocking: input.blocking === true,
    entity: input.entity ?? null,
    email: input.email ?? null,
    feedbackId: input.feedbackId ?? null,
    details: input.details ?? null,
    lastAction: null,
  };
}

function mapQueueItem(
  row: AuditRow,
  overlay: QueueOverlay | null,
): PilotQueueItem | null {
  const metadata = readRecord(row.metadata);
  const title = readString(metadata.title);
  const message = readString(metadata.message);
  if (!title || !message) {
    return null;
  }

  return {
    id: row.id,
    source: normalizeQueueSource(readString(metadata.source)),
    title,
    message,
    severity: normalizeSeverity(readString(metadata.severity)),
    route: readString(metadata.route),
    role: readString(metadata.role),
    status: overlay?.status ?? normalizeQueueStatus(readString(metadata.status)),
    owner: overlay?.owner ?? readString(metadata.owner),
    createdAt: row.createdAt.toISOString(),
    updatedAt: overlay?.updatedAt ?? row.createdAt.toISOString(),
    eventType: (() => {
      const value = readString(metadata.eventType);
      return value && PILOT_METRIC_EVENT_TYPES.includes(value as PilotMetricEventType)
        ? (value as PilotMetricEventType)
        : null;
    })(),
    blocking: readBoolean(metadata.blocking),
    entity: readEntity(metadata),
    email: readString(metadata.email),
    feedbackId: readString(metadata.feedbackId),
    details: readObject(metadata.details),
    lastAction: overlay
      ? {
          status: overlay.status,
          owner: overlay.owner,
          note: overlay.note,
          actorId: overlay.actorId,
          updatedAt: overlay.updatedAt,
        }
      : null,
  };
}

function buildQueueOverlays(rows: readonly AuditRow[]): Map<string, QueueOverlay> {
  const overlays = new Map<string, QueueOverlay>();

  const sorted = [...rows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  for (const row of sorted) {
    if (!row.referenceId) {
      continue;
    }

    const metadata = readRecord(row.metadata);
    overlays.set(row.referenceId, {
      status: normalizeQueueStatus(readString(metadata.status)),
      owner: readString(metadata.owner),
      note: readString(metadata.note),
      actorId: readString(metadata.actorId),
      updatedAt: row.createdAt.toISOString(),
    });
  }

  return overlays;
}

function versionTruth(): {
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
} {
  return {
    buildVersion:
      process.env.BUILD_VERSION
      ?? process.env.npm_package_version
      ?? 'unknown',
    commitHash:
      process.env.COMMIT_HASH
      ?? process.env.GIT_COMMIT_HASH
      ?? process.env.GITHUB_SHA
      ?? process.env.VERCEL_GIT_COMMIT_SHA
      ?? 'unknown',
    nodeVersion: process.version,
  };
}

export async function recordPilotMetricEvent(
  input: RecordPilotMetricInput,
): Promise<{ eventId: string; queueItemId: string | null }> {
  const event = await writeAuditEvent({
    type: PILOT_EVENT_AUDIT_TYPE,
    organizationId: input.organizationId ?? null,
    metadata: {
      eventType: input.eventType,
      route: input.route,
      role: input.role ?? null,
      severity: normalizeSeverity(input.severity ?? null),
      message: input.message ?? null,
      entity: input.entity ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,
      details: input.details ?? null,
    },
  });

  let queueItemId: string | null = null;
  if (input.queueItem) {
    const queueItem = await createQueueItem({
      source: input.queueItem.source,
      title: input.queueItem.title,
      message: input.queueItem.message,
      severity: normalizeSeverity(input.queueItem.severity ?? input.severity ?? null),
      route: input.route,
      role: input.role ?? null,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,
      entity: input.entity ?? null,
      eventType: input.eventType,
      details: input.details ?? null,
      blocking: input.queueItem.blocking === true,
    });
    queueItemId = queueItem.id;
  }

  return {
    eventId: event.id,
    queueItemId,
  };
}

export async function submitPilotFeedback(
  input: SubmitPilotFeedbackInput,
): Promise<{ feedbackId: string; queueItemId: string | null }> {
  const feedbackType = input.type === 'nps' || input.type === 'feature' ? input.type : 'bug';
  const message = (input.message ?? '').trim();
  const email = typeof input.email === 'string' && input.email.trim().length > 0
    ? input.email.trim()
    : null;
  const feedbackMessage = message.length > 0
    ? message
    : feedbackType === 'nps'
      ? 'NPS feedback submitted'
      : 'Pilot feedback submitted';

  // TODO: removed - referenced non-existent Prisma model (feedback)
  const feedback = { id: `feedback-${Date.now()}` };

  await recordPilotMetricEvent({
    eventType: 'feedback_submitted',
    route: input.route,
    role: input.role ?? null,
    severity: normalizeSeverity(
      input.kind === 'support' ? 'high' : input.type === 'bug' ? 'medium' : 'low',
    ),
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    email,
    entity: input.entity ?? null,
    details: {
      kind: input.kind,
      feedbackType: feedbackType,
      feedbackId: feedback.id,
      score: isFiniteNumber(input.score) ? input.score : null,
      details: input.details ?? null,
    },
  });

  const queueItem = await createQueueItem({
    source: input.kind === 'support' ? 'support' : 'feedback',
    title:
      input.kind === 'support'
        ? 'Pilot support request'
        : input.kind === 'issue'
          ? 'Pilot issue report'
          : feedbackType === 'nps'
            ? 'Pilot NPS feedback'
            : 'Pilot feedback',
    message: feedbackMessage,
    severity: normalizeSeverity(
      input.kind === 'support'
        ? 'high'
        : input.kind === 'issue' || feedbackType === 'bug'
          ? 'medium'
          : 'low',
    ),
    route: input.route,
    role: input.role ?? null,
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    email,
    entity: input.entity ?? null,
    eventType: input.kind === 'support' ? 'support_triggered' : 'feedback_submitted',
    feedbackId: feedback.id,
    details: {
      kind: input.kind,
      feedbackType,
      score: isFiniteNumber(input.score) ? input.score : null,
      details: input.details ?? null,
    },
    blocking: input.kind === 'support',
  });
  const queueItemId = queueItem.id;

  if (input.kind === 'support') {
    await recordPilotMetricEvent({
      eventType: 'support_triggered',
      route: input.route,
      role: input.role ?? null,
      severity: 'high',
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      email,
      entity: input.entity ?? null,
      details: {
        feedbackId: feedback.id,
        queueItemId,
        supportKind: input.kind,
      },
    });
  }

  log('info', 'pilot_feedback_recorded', {
    event: 'pilot_feedback_recorded',
    feedbackId: feedback.id,
    kind: input.kind,
    route: input.route,
    queueItemId,
  });

  return {
    feedbackId: feedback.id,
    queueItemId,
  };
}

export async function createPilotQueueItem(
  input: CreatePilotQueueItemInput,
): Promise<PilotQueueItem> {
  return createQueueItem({
    source: input.source,
    title: input.title,
    message: input.message,
    severity: normalizeSeverity(input.severity ?? null),
    route: input.route,
    owner: input.owner ?? null,
    status: input.status ?? 'NEW',
    role: input.role ?? null,
    organizationId: input.organizationId ?? null,
    userId: input.userId ?? null,
    email: input.email ?? null,
    entity: input.entity ?? null,
    details: input.details ?? null,
    blocking: input.blocking === true,
  });
}

function buildSurfaceControls(rows: readonly AuditRow[]): PilotSurfaceControl[] {
  const latestBySurface = new Map<string, AuditRow>();
  const sorted = [...rows].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  for (const row of sorted) {
    const metadata = readRecord(row.metadata);
    const surfaceId = readString(metadata.surfaceId);
    if (!surfaceId) {
      continue;
    }
    latestBySurface.set(surfaceId, row);
  }

  return PILOT_SURFACE_DEFINITIONS.map((definition) => {
    const latest = latestBySurface.get(definition.surfaceId);
    const metadata = latest ? readRecord(latest.metadata) : {};

    return {
      surfaceId: definition.surfaceId,
      label: definition.label,
      affectsRoutes: [...definition.affectsRoutes],
      mode: normalizeSurfaceMode(readString(metadata.mode)),
      reason: readString(metadata.reason),
      updatedAt: latest?.createdAt.toISOString() ?? null,
      updatedBy: readString(metadata.updatedBy),
    };
  });
}

export async function listPilotSurfaceControls(
  lookbackHours = LOOKBACK_DAYS * 24,
): Promise<PilotSurfaceControl[]> {
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const rows = await prisma.auditEvent.findMany({
    where: {
      type: PILOT_SURFACE_CONTROL_AUDIT_TYPE,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      referenceId: true,
      metadata: true,
      createdAt: true,
    },
  });

  return buildSurfaceControls(rows);
}

export async function setPilotSurfaceControl(
  input: SetPilotSurfaceControlInput,
): Promise<PilotSurfaceControl> {
  const definition = PILOT_SURFACE_DEFINITIONS.find((entry) => entry.surfaceId === input.surfaceId);
  if (!definition) {
    throw new Error('Surface control not found.');
  }

  await writeAuditEvent({
    type: PILOT_SURFACE_CONTROL_AUDIT_TYPE,
    referenceId: input.surfaceId,
    organizationId: input.organizationId ?? null,
    metadata: {
      surfaceId: input.surfaceId,
      mode: input.mode,
      reason: input.reason ?? null,
      updatedBy: input.userId ?? input.email ?? null,
    },
  });

  const controls = await listPilotSurfaceControls(LOOKBACK_DAYS * 24);
  const control = controls.find((entry) => entry.surfaceId === input.surfaceId);
  if (!control) {
    throw new Error('Surface control not found.');
  }
  return control;
}

export async function updatePilotQueueItem(
  input: UpdatePilotQueueItemInput,
): Promise<{ itemId: string; status: PilotQueueStatus; owner: string | null }> {
  const queueItem = await prisma.auditEvent.findUnique({
    where: { id: input.itemId },
    select: { id: true, metadata: true, createdAt: true },
  });

  if (!queueItem) {
    throw new Error('Queue item not found.');
  }

  const metadata = readRecord(queueItem.metadata);
  const route = readString(metadata.route) ?? '/internal/pilot-ops';
  const role = readString(metadata.role) ?? input.role ?? 'ADMIN';
  const severity = normalizeSeverity(readString(metadata.severity));

  await writeAuditEvent({
    type: PILOT_QUEUE_UPDATE_AUDIT_TYPE,
    referenceId: input.itemId,
    organizationId: input.organizationId ?? null,
    metadata: {
      status: input.status,
      owner: input.owner ?? null,
      note: input.note ?? null,
      actorId: input.userId ?? null,
    },
  });

  if (input.status === 'RESOLVED') {
    await recordPilotMetricEvent({
      eventType: 'blocker_resolved',
      route,
      role,
      severity,
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      email: input.email ?? null,
      entity: readEntity(metadata),
      details: {
        queueItemId: input.itemId,
        note: input.note ?? null,
      },
    });
  }

  return {
    itemId: input.itemId,
    status: input.status,
    owner: input.owner ?? null,
  };
}

export async function getPilotOpsSummary(options: {
  lookbackHours?: number;
} = {}): Promise<PilotOpsSummary> {
  const lookbackHours = options.lookbackHours ?? LOOKBACK_DAYS * 24;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);
  const version = versionTruth();

  const [
    auditRows,
    controlRows,
    systemFailures,
    providerCount,
    findingsCount,
    storylineCount,
    opportunitiesCount,
    graphNodeCount,
    graphEdgeCount,
    activeApplications,
  ] = await Promise.all([
    prisma.auditEvent.findMany({
      where: {
        type: {
          in: [
            PILOT_EVENT_AUDIT_TYPE,
            PILOT_QUEUE_ITEM_AUDIT_TYPE,
            PILOT_QUEUE_UPDATE_AUDIT_TYPE,
          ],
        },
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        referenceId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: {
        type: PILOT_SURFACE_CONTROL_AUDIT_TYPE,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        referenceId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    // TODO: removed - referenced non-existent Prisma model (systemFailureEvent)
    Promise.resolve([] as Array<{ id: string; component: string; severity: string; message: string; createdAt: Date }>),
    prisma.provider.count(),
    prisma.investigatorFinding.count(),
    prisma.storyline.count(),
    prisma.opportunity.count({ where: { status: 'ACTIVE' } }),
    prisma.graphNode.count(),
    prisma.graphEdge.count(),
    // TODO: removed - referenced non-existent Prisma model (application)
    Promise.resolve(0),
  ]);

  const metricRows = auditRows.filter((row) => row.type === PILOT_EVENT_AUDIT_TYPE);
  const queueRows = auditRows.filter((row) => row.type === PILOT_QUEUE_ITEM_AUDIT_TYPE);
  const queueUpdateRows = auditRows.filter((row) => row.type === PILOT_QUEUE_UPDATE_AUDIT_TYPE);

  const overlays = buildQueueOverlays(queueUpdateRows);
  const queueItems = queueRows
    .map((row) => mapQueueItem(row, overlays.get(row.id) ?? null))
    .filter((row): row is PilotQueueItem => row !== null);

  const failureItems: PilotQueueItem[] = systemFailures.map((failure) => ({
    id: failure.id,
    source: 'system_failure',
    title: failure.component,
    message: failure.message,
    severity: normalizeSeverity(failure.severity),
    route: failure.component,
    role: null,
    status: 'NEW',
    owner: null,
    createdAt: failure.createdAt.toISOString(),
    updatedAt: failure.createdAt.toISOString(),
    eventType: 'route_failure',
    blocking: failure.severity === 'critical' || failure.severity === 'error',
    entity: null,
    email: null,
    feedbackId: null,
    details: null,
    lastAction: null,
  }));

  const queue = [...queueItems, ...failureItems]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, 50);

  return {
    generatedAt: new Date().toISOString(),
    metrics: {
      signIns: metricEventCount(metricRows, 'sign_in'),
      onboardingStarted: metricEventCount(metricRows, 'onboarding_started'),
      onboardingCompleted: metricEventCount(metricRows, 'onboarding_completed'),
      readinessViewed: metricEventCount(metricRows, 'readiness_viewed'),
      passportViewed: metricEventCount(metricRows, 'passport_viewed'),
      reviewRequested: metricEventCount(metricRows, 'review_requested'),
      reviewOpened: metricEventCount(metricRows, 'review_opened'),
      blockerOpened: metricEventCount(metricRows, 'blocker_opened'),
      blockerResolved: metricEventCount(metricRows, 'blocker_resolved'),
      opportunityViewed: metricEventCount(metricRows, 'opportunity_viewed'),
      applyStarted: metricEventCount(metricRows, 'apply_started'),
      applySubmitted: metricEventCount(metricRows, 'apply_submitted'),
      applicationDetailViewed: metricEventCount(metricRows, 'application_detail_viewed'),
      applicationStatusViewed: metricEventCount(metricRows, 'application_status_viewed'),
      alertViewed: metricEventCount(metricRows, 'alert_viewed'),
      walletViewed: metricEventCount(metricRows, 'wallet_viewed'),
      returnSession: metricEventCount(metricRows, 'return_session'),
      feedbackSubmitted: metricEventCount(metricRows, 'feedback_submitted'),
      supportTriggered: metricEventCount(metricRows, 'support_triggered'),
      authFailures: metricEventCount(metricRows, 'auth_failure'),
      routeFailures: metricEventCount(metricRows, 'route_failure') + failureItems.length,
      openQueueItems: queue.filter((item) => item.status !== 'RESOLVED').length,
      criticalQueueItems: queue.filter((item) => item.severity === 'critical').length,
    },
    queue,
    baseline: {
      providerCount,
      findingsCount,
      storylineCount,
      opportunitiesCount,
      graphNodeCount,
      graphEdgeCount,
      activeApplications,
      buildVersion: version.buildVersion,
      commitHash: version.commitHash,
      nodeVersion: version.nodeVersion,
    },
    surfaceControls: buildSurfaceControls(controlRows),
  };
}
