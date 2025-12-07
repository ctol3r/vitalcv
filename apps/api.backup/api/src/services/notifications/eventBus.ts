import { EventEmitter } from 'node:events'

export type ClinicianIdentifierFields = {
  clinicianId?: string
  clinicianDid?: string
  npi?: string
  userId?: string
  notificationUserId?: string
}

type ApplicationSubmittedPayload = {
  applicationId: string
  jobId: string
  orgId: string
  applicantDid: string
  applicantName?: string
  jobTitle?: string
}

type PrivilegeRequestedPayload = ClinicianIdentifierFields & {
  privilegeRequestId: string
  privilegeSetId: string
  privilegeSetName?: string
  orgId: string
  clinicianName?: string
}

type PrivilegeDecisionPayload = ClinicianIdentifierFields & {
  privilegeRequestId: string
  privilegeSetName?: string
  orgId: string
  reviewerDid?: string
  reviewNotes?: string
  clinicianUserId?: string
  clinicianEmail?: string
  status: 'APPROVED' | 'DENIED'
}

type PsvCompletedPayload = ClinicianIdentifierFields & {
  clinicianId: string
  orgId?: string
  isFresh: boolean
  passed: boolean
  hasSanctions: boolean
  summary?: Record<string, unknown>
  status: 'PSV_PASSED' | 'PSV_PASSED_WITH_WARNINGS' | 'PSV_FAILED'
}

type PayerSubmittedPayload = ClinicianIdentifierFields & {
  enrollmentId: string
  clinicianDid: string
  payerId: string
  payerName: string
  orgId?: string
}

type LicenseStatusUpdatedPayload = ClinicianIdentifierFields & {
  state: string
  status: string
  licenseNumber?: string
  source?: string
  checkedAt?: string
  notes?: string
}

type PecosEnrollmentUpdatedPayload = ClinicianIdentifierFields & {
  pecosId?: string
  status: string
  updatedAt?: string
  source?: string
}

type DeaRegistrationUpdatedPayload = ClinicianIdentifierFields & {
  registrationNumber: string
  status: string
  expiresAt?: string
  updatedAt?: string
  schedule?: string
}

type BoardCertificationUpdatedPayload = ClinicianIdentifierFields & {
  boardName: string
  status: string
  issuedAt?: string
  expiresAt?: string
  specialty?: string
}

type CompactEligibilityUpdatedPayload = ClinicianIdentifierFields & {
  compactType: string
  homeState: string
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING'
  updatedAt?: string
  expiresAt?: string
}

type CredentialDiscrepancyFoundPayload = ClinicianIdentifierFields & {
  issue: string
  severity: 'NOTICE' | 'WARNING' | 'CRITICAL'
  detectedAt?: string
  remediation?: string
  metadata?: Record<string, unknown>
}

export type EventPayloadMap = {
  ApplicationSubmitted: ApplicationSubmittedPayload
  PrivilegeRequested: PrivilegeRequestedPayload
  PrivilegeApproved: PrivilegeDecisionPayload
  PrivilegeDenied: PrivilegeDecisionPayload
  PSVCompleted: PsvCompletedPayload
  PayerSubmitted: PayerSubmittedPayload
  LicenseStatusUpdated: LicenseStatusUpdatedPayload
  PecosEnrollmentUpdated: PecosEnrollmentUpdatedPayload
  DeaRegistrationUpdated: DeaRegistrationUpdatedPayload
  BoardCertificationUpdated: BoardCertificationUpdatedPayload
  CompactEligibilityUpdated: CompactEligibilityUpdatedPayload
  CredentialDiscrepancyFound: CredentialDiscrepancyFoundPayload
  FHIRSubscriptionNotification: {
    topic: string
    data: unknown
    headers?: Record<string, string | undefined>
    receivedAt: string
  }
}

export type EventType = keyof EventPayloadMap
export type EventPayload<T extends EventType = EventType> = EventPayloadMap[T]

export type DomainEvent<T extends EventType = EventType> = {
  type: T
  payload: EventPayload<T>
  emittedAt: Date
}

type EventHandler<T extends EventType = EventType> = (payload: EventPayload<T>) => Promise<void> | void
type WildcardHandler = (event: DomainEvent) => Promise<void> | void

class DomainEventBus {
  private emitter = new EventEmitter()
  private wildcardHandlers = new Set<WildcardHandler>()

  constructor() {
    this.emitter.setMaxListeners(0)
  }

  async publish<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void> {
    const emittedAt = new Date()
    const listeners = this.emitter.listeners(type) as EventHandler<T>[]
    await Promise.allSettled(listeners.map((handler) => this.invokeHandler(handler, payload, type)))
    await Promise.allSettled(
      Array.from(this.wildcardHandlers).map((handler) => this.invokeWildcard(handler, { type, payload, emittedAt }))
    )
  }

  subscribe<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    this.emitter.on(type, handler)
    return () => {
      this.emitter.off(type, handler)
    }
  }

  onEvent<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
    return this.subscribe(type, handler)
  }

  subscribeToAll(handler: WildcardHandler): () => void {
    this.wildcardHandlers.add(handler)
    return () => {
      this.wildcardHandlers.delete(handler)
    }
  }

  private async invokeHandler<T extends EventType>(
    handler: EventHandler<T>,
    payload: EventPayload<T>,
    type: T
  ): Promise<void> {
    try {
      await handler(payload)
    } catch (error) {
      console.error(`[eventBus] Handler failed for ${type}`, error)
    }
  }

  private async invokeWildcard(handler: WildcardHandler, event: DomainEvent): Promise<void> {
    try {
      await handler(event)
    } catch (error) {
      console.error('[eventBus] Wildcard handler failed', error)
    }
  }
}

export const eventBus = new DomainEventBus()


