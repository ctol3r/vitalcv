import crypto from 'node:crypto'
import { CredentialTimelineEventType, Prisma, PrismaClient, TimelineEventSeverity } from '@prisma/client'
import {
  eventBus,
  type ClinicianIdentifierFields,
  type EventPayload,
  type EventPayloadMap,
  type EventType,
} from '../../backend/src/services/notifications/eventBus'

const prisma = new PrismaClient()

type TimelineProjection = {
  eventType: CredentialTimelineEventType
  severity: TimelineEventSeverity
  timestamp?: Date
  metadata?: Record<string, unknown>
  clinicianHints?: ClinicianIdentifierFields
}

const EVENT_PROJECTIONS: Partial<
  {
    [K in EventType]: (payload: EventPayloadMap[K]) => TimelineProjection | null
  }
> = {
  LicenseStatusUpdated: (payload) => ({
    eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
    severity: mapLicenseSeverity(payload.status),
    timestamp: toDate(payload.checkedAt),
    metadata: {
      state: payload.state,
      status: payload.status,
      licenseNumber: payload.licenseNumber,
      source: payload.source ?? 'state_board',
      notes: payload.notes,
    },
    clinicianHints: payload,
  }),
  PSVCompleted: (payload) => ({
    eventType: CredentialTimelineEventType.LICENSE_VERIFIED,
    severity: payload.status === 'PSV_FAILED' ? 'CRITICAL' : payload.status === 'PSV_PASSED_WITH_WARNINGS' ? 'WARNING' : 'NOTICE',
    timestamp: new Date(),
    metadata: {
      status: payload.status,
      passed: payload.passed,
      hasSanctions: payload.hasSanctions,
      isFresh: payload.isFresh,
      summary: payload.summary,
    },
    clinicianHints: payload,
  }),
  PecosEnrollmentUpdated: (payload) => ({
    eventType: CredentialTimelineEventType.PECOS_VERIFIED,
    severity: mapPecosSeverity(payload.status),
    timestamp: toDate(payload.updatedAt),
    metadata: {
      status: payload.status,
      pecosId: payload.pecosId,
      source: payload.source ?? 'pecos',
    },
    clinicianHints: payload,
  }),
  PayerSubmitted: (payload) => ({
    eventType: CredentialTimelineEventType.PECOS_VERIFIED,
    severity: 'NOTICE',
    timestamp: new Date(),
    metadata: {
      status: 'SUBMITTED',
      payerId: payload.payerId,
      payerName: payload.payerName,
      enrollmentId: payload.enrollmentId,
    },
    clinicianHints: payload,
  }),
  DeaRegistrationUpdated: (payload) => ({
    eventType: CredentialTimelineEventType.DEA_VERIFIED,
    severity: mapDeaSeverity(payload.status),
    timestamp: toDate(payload.updatedAt ?? payload.expiresAt),
    metadata: {
      registrationNumber: payload.registrationNumber,
      status: payload.status,
      schedule: payload.schedule,
      expiresAt: payload.expiresAt,
    },
    clinicianHints: payload,
  }),
  BoardCertificationUpdated: (payload) => ({
    eventType: CredentialTimelineEventType.BOARD_VERIFIED,
    severity: mapBoardSeverity(payload.status),
    timestamp: toDate(payload.issuedAt ?? payload.expiresAt),
    metadata: {
      boardName: payload.boardName,
      specialty: payload.specialty,
      status: payload.status,
      expiresAt: payload.expiresAt,
    },
    clinicianHints: payload,
  }),
  CompactEligibilityUpdated: (payload) => ({
    eventType: CredentialTimelineEventType.COMPACT_ELIGIBILITY_UPDATED,
    severity: payload.status === 'ACTIVE' ? 'INFO' : payload.status === 'PENDING' ? 'NOTICE' : 'WARNING',
    timestamp: toDate(payload.updatedAt ?? payload.expiresAt),
    metadata: {
      compactType: payload.compactType,
      homeState: payload.homeState,
      status: payload.status,
      expiresAt: payload.expiresAt,
    },
    clinicianHints: payload,
  }),
  CredentialDiscrepancyFound: (payload) => ({
    eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
    severity: payload.severity,
    timestamp: toDate(payload.detectedAt),
    metadata: {
      issue: payload.issue,
      remediation: payload.remediation,
      details: payload.metadata,
    },
    clinicianHints: payload,
  }),
  PrivilegeApproved: (payload) => ({
    eventType: CredentialTimelineEventType.PRIVILEGE_GRANTED,
    severity: 'INFO',
    timestamp: new Date(),
    metadata: {
      privilegeRequestId: payload.privilegeRequestId,
      privilegeSetName: payload.privilegeSetName,
      reviewerDid: payload.reviewerDid,
      reviewNotes: payload.reviewNotes,
      status: payload.status,
    },
    clinicianHints: payload,
  }),
  PrivilegeDenied: (payload) => ({
    eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
    severity: 'WARNING',
    timestamp: new Date(),
    metadata: {
      privilegeRequestId: payload.privilegeRequestId,
      privilegeSetName: payload.privilegeSetName,
      reviewerDid: payload.reviewerDid,
      reviewNotes: payload.reviewNotes,
      status: payload.status,
    },
    clinicianHints: payload,
  }),
  ApplicationSubmitted: (payload) => ({
    eventType: CredentialTimelineEventType.REVALIDATION_CREATED,
    severity: 'NOTICE',
    timestamp: new Date(),
    metadata: {
      applicationId: payload.applicationId,
      jobId: payload.jobId,
      jobTitle: payload.jobTitle,
      applicantDid: payload.applicantDid,
      applicantName: payload.applicantName,
    },
    clinicianHints: payload,
  }),
}

type SubscriptionCategory = 'license' | 'pecos' | 'dea' | 'board' | 'compact' | 'discrepancy'

export type SubscriptionProcessorEventInput = ClinicianIdentifierFields & {
  category: SubscriptionCategory
  status: string
  occurredAt?: string | Date
  source?: string
  state?: string
  licenseNumber?: string
  pecosId?: string
  registrationNumber?: string
  boardName?: string
  specialty?: string
  compactType?: string
  homeState?: string
  description?: string
  severityOverride?: TimelineEventSeverity
  metadata?: Record<string, unknown>
  expiresAt?: string | Date
  schedule?: string
}

const CATEGORY_TO_EVENT: Record<SubscriptionCategory, EventType> = {
  license: 'LicenseStatusUpdated',
  pecos: 'PecosEnrollmentUpdated',
  dea: 'DeaRegistrationUpdated',
  board: 'BoardCertificationUpdated',
  compact: 'CompactEligibilityUpdated',
  discrepancy: 'CredentialDiscrepancyFound',
}

export async function emitSubscriptionProcessorEvent(input: SubscriptionProcessorEventInput): Promise<void> {
  const eventType = CATEGORY_TO_EVENT[input.category]
  const payload = mapSubscriptionInputToPayload(eventType, input)
  await eventBus.publish(eventType, payload as EventPayload<typeof eventType>)
}

function mapSubscriptionInputToPayload<T extends EventType>(
  type: T,
  input: SubscriptionProcessorEventInput
): EventPayloadMap[T] {
  const base: ClinicianIdentifierFields = {
    clinicianId: input.clinicianId,
    clinicianDid: input.clinicianDid,
    npi: input.npi,
    userId: input.userId,
    notificationUserId: input.notificationUserId,
  }

  switch (type) {
    case 'LicenseStatusUpdated':
      return {
        ...base,
        state: input.state ?? 'UNKNOWN',
        status: input.status,
        licenseNumber: input.licenseNumber,
        source: input.source,
        checkedAt: toIsoString(input.occurredAt),
        notes: input.description,
      } as EventPayloadMap[T]
    case 'PecosEnrollmentUpdated':
      return {
        ...base,
        status: input.status,
        pecosId: input.pecosId,
        source: input.source,
        updatedAt: toIsoString(input.occurredAt),
      } as EventPayloadMap[T]
    case 'DeaRegistrationUpdated':
      return {
        ...base,
        registrationNumber: input.registrationNumber ?? 'UNKNOWN',
        status: input.status,
        schedule: input.schedule,
        updatedAt: toIsoString(input.occurredAt),
        expiresAt: toIsoString(input.expiresAt),
      } as EventPayloadMap[T]
    case 'BoardCertificationUpdated':
      return {
        ...base,
        boardName: input.boardName ?? 'Board certification',
        status: input.status,
        issuedAt: toIsoString(input.occurredAt),
        specialty: input.specialty,
        expiresAt: toIsoString(input.expiresAt),
      } as EventPayloadMap[T]
    case 'CompactEligibilityUpdated':
      return {
        ...base,
        compactType: input.compactType ?? 'IMLC',
        homeState: input.homeState ?? 'NA',
        status: (input.status as 'ACTIVE' | 'INACTIVE' | 'PENDING') ?? 'PENDING',
        updatedAt: toIsoString(input.occurredAt),
        expiresAt: toIsoString(input.expiresAt),
      } as EventPayloadMap[T]
    case 'CredentialDiscrepancyFound':
      return {
        ...base,
        issue: input.description ?? 'Discrepancy detected',
        severity: input.severityOverride ?? 'WARNING',
        detectedAt: toIsoString(input.occurredAt),
        remediation: input.metadata?.remediation as string | undefined,
        metadata: input.metadata,
      } as EventPayloadMap[T]
    default:
      return { ...base, status: input.status } as EventPayloadMap[T]
  }
}

let wired = false

export function registerTimelineRealtimeIntegration(): void {
  if (wired) {
    return
  }

  ;(Object.keys(EVENT_PROJECTIONS) as EventType[]).forEach((eventType) => {
    const resolver = EVENT_PROJECTIONS[eventType]
    if (!resolver) {
      return
    }

    eventBus.onEvent(eventType, async (payload) => {
      try {
        const projection = resolver(payload as EventPayload<typeof eventType>)
        if (!projection) {
          return
        }
        const clinicianId = await resolveClinicianProfileId(projection.clinicianHints ?? (payload as ClinicianIdentifierFields))
        if (!clinicianId) {
          console.warn(`[timeline] Unable to resolve clinician for ${eventType}`)
          return
        }
        await persistTimelineEvent({
          clinicianId,
          eventType: projection.eventType,
          severity: projection.severity,
          timestamp: projection.timestamp ?? new Date(),
          metadata: projection.metadata,
        })
      } catch (error) {
        console.error(`[timeline] Failed to process ${eventType}`, error)
      }
    })
  })

  wired = true
}

registerTimelineRealtimeIntegration()

async function persistTimelineEvent(input: {
  clinicianId: string
  eventType: CredentialTimelineEventType
  severity: TimelineEventSeverity
  timestamp: Date
  metadata?: Record<string, unknown>
}): Promise<void> {
  const auditHash = createAuditHash(input)
  try {
    await prisma.credentialTimelineEvent.create({
      data: {
        clinicianId: input.clinicianId,
        eventType: input.eventType,
        severity: input.severity,
        timestamp: input.timestamp,
        metadata: input.metadata as Prisma.JsonObject | undefined,
        auditHash,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return
    }
    console.error('[timeline] Failed to persist realtime event', error)
  }
}

function createAuditHash(input: {
  clinicianId: string
  eventType: CredentialTimelineEventType
  severity: TimelineEventSeverity
  timestamp: Date
  metadata?: Record<string, unknown>
}): string {
  const payload = JSON.stringify({
    clinicianId: input.clinicianId,
    eventType: input.eventType,
    severity: input.severity,
    timestamp: input.timestamp.toISOString(),
    metadata: input.metadata ?? null,
  })
  return crypto.createHash('sha256').update(payload).digest('hex')
}

async function resolveClinicianProfileId(hints?: ClinicianIdentifierFields): Promise<string | null> {
  if (!hints) {
    return null
  }

  if (hints.clinicianId) {
    const byId = await prisma.clinicianProfile.findUnique({
      where: { id: hints.clinicianId },
      select: { id: true },
    })
    if (byId) {
      return byId.id
    }

    const byNpi = await prisma.clinicianProfile.findFirst({
      where: { npi: hints.clinicianId },
      select: { id: true },
    })
    if (byNpi) {
      return byNpi.id
    }
  }

  if (hints.npi) {
    const byNpi = await prisma.clinicianProfile.findFirst({
      where: { npi: hints.npi },
      select: { id: true },
    })
    if (byNpi) {
      return byNpi.id
    }
  }

  const userReference = hints.userId ?? hints.notificationUserId
  if (userReference) {
    const byUser = await prisma.clinicianProfile.findFirst({
      where: { userId: userReference },
      select: { id: true },
    })
    if (byUser) {
      return byUser.id
    }
  }

  if (hints.clinicianDid) {
    const byDid = await prisma.clinicianProfile.findFirst({
      where: {
        user: {
          did: hints.clinicianDid,
        },
      },
      select: { id: true },
    })
    if (byDid) {
      return byDid.id
    }
  }

  return null
}

function toIsoString(value?: string | Date): string | undefined {
  if (!value) {
    return undefined
  }
  if (typeof value === 'string') {
    return value
  }
  return value.toISOString()
}

function toDate(value?: string): Date | undefined {
  if (!value) {
    return undefined
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function mapLicenseSeverity(status: string): TimelineEventSeverity {
  const normalized = status.toUpperCase()
  if (normalized === 'ACTIVE' || normalized === 'CLEAR') {
    return 'INFO'
  }
  if (normalized === 'PENDING' || normalized === 'SUBMITTED') {
    return 'NOTICE'
  }
  if (normalized === 'EXPIRED' || normalized === 'LAPSED') {
    return 'WARNING'
  }
  return 'CRITICAL'
}

function mapPecosSeverity(status: string): TimelineEventSeverity {
  const normalized = status.toUpperCase()
  if (normalized === 'APPROVED' || normalized === 'ACTIVE') {
    return 'INFO'
  }
  if (normalized === 'SUBMITTED' || normalized === 'PENDING') {
    return 'NOTICE'
  }
  if (normalized === 'REVALIDATION_DUE') {
    return 'WARNING'
  }
  return 'CRITICAL'
}

function mapDeaSeverity(status: string): TimelineEventSeverity {
  const normalized = status.toUpperCase()
  if (normalized === 'ACTIVE') {
    return 'INFO'
  }
  if (normalized === 'EXPIRING_SOON') {
    return 'NOTICE'
  }
  if (normalized === 'EXPIRED') {
    return 'WARNING'
  }
  return 'CRITICAL'
}

function mapBoardSeverity(status: string): TimelineEventSeverity {
  const normalized = status.toUpperCase()
  if (normalized === 'CERTIFIED' || normalized === 'ACTIVE') {
    return 'INFO'
  }
  if (normalized === 'IN_PROGRESS' || normalized === 'MAINTENANCE') {
    return 'NOTICE'
  }
  if (normalized === 'EXPIRED') {
    return 'WARNING'
  }
  return 'CRITICAL'
}


