const state = {
  sourceRuns: [] as Array<Record<string, unknown>>,
  fetchJobs: [] as Array<Record<string, unknown>>,
  parseJobs: [] as Array<Record<string, unknown>>,
  claimDerivationJobs: [] as Array<Record<string, unknown>>,
  deltaDetectionJobs: [] as Array<Record<string, unknown>>,
  alertJobs: [] as Array<Record<string, unknown>>,
  sourceRecords: [] as Array<Record<string, unknown>>,
  verificationArtifacts: [] as Array<Record<string, unknown>>,
  claimRecords: [] as Array<Record<string, unknown>>,
  verificationReceiptRecords: [] as Array<Record<string, unknown>>,
  identityClaimDeltas: [] as Array<Record<string, unknown>>,
  trustAlertRecords: [] as Array<Record<string, unknown>>,
  watchlists: [] as Array<Record<string, unknown>>,
  entityChangeEvents: [] as Array<Record<string, unknown>>,
  sourceStalenessEvents: [] as Array<Record<string, unknown>>,
  trustDegradationEvents: [] as Array<Record<string, unknown>>,
  watchlistHits: [] as Array<Record<string, unknown>>,
  alertDeliveryAttempts: [] as Array<Record<string, unknown>>,
  identityResolutionDecisions: [] as Array<Record<string, unknown>>,
  auditEvents: [] as Array<Record<string, unknown>>,
}

let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

function resetState(): void {
  idCounter = 0
  Object.values(state).forEach((rows) => {
    rows.splice(0, rows.length)
  })
}

function clone<T>(value: T): T {
  return structuredClone(value)
}

function matchesWhere(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) {
    return true
  }

  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if ('not' in value) {
        return row[key] !== (value as { not: unknown }).not
      }
      if ('gte' in value) {
        const candidate = row[key]
        const candidateComparable = candidate instanceof Date ? candidate.getTime() : candidate
        const threshold = (value as { gte: Date | number }).gte
        const thresholdComparable = threshold instanceof Date ? threshold.getTime() : threshold
        return (candidateComparable as number) >= thresholdComparable
      }
    }

    return row[key] === value
  })
}

function applyOrder(
  rows: Array<Record<string, unknown>>,
  orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>,
): Array<Record<string, unknown>> {
  if (!orderBy) {
    return rows
  }

  const orderings = Array.isArray(orderBy) ? orderBy : [orderBy]
  return [...rows].sort((left, right) => {
    for (const ordering of orderings) {
      const [field, direction] = Object.entries(ordering)[0]!
      const leftValue = left[field]
      const rightValue = right[field]

      if (leftValue === rightValue) {
        continue
      }

      const leftComparable = leftValue instanceof Date ? leftValue.getTime() : leftValue
      const rightComparable = rightValue instanceof Date ? rightValue.getTime() : rightValue

      if (leftComparable === undefined || leftComparable === null) {
        return direction === 'desc' ? 1 : -1
      }
      if (rightComparable === undefined || rightComparable === null) {
        return direction === 'desc' ? -1 : 1
      }

      if ((leftComparable as number | string) > (rightComparable as number | string)) {
        return direction === 'desc' ? -1 : 1
      }

      return direction === 'desc' ? 1 : -1
    }

    return 0
  })
}

function applySelect(
  row: Record<string, unknown>,
  select?: Record<string, boolean>,
): Record<string, unknown> {
  if (!select) {
    return clone(row)
  }

  return Object.fromEntries(
    Object.entries(select)
      .filter(([, enabled]) => enabled)
      .map(([key]) => [key, clone(row[key])]),
  )
}

function makeModel(
  rows: Array<Record<string, unknown>>,
  prefix: string,
): {
  create: jest.Mock
  update: jest.Mock
  findFirst: jest.Mock
  findMany: jest.Mock
} {
  return {
    create: jest.fn(async ({ data, select }: { data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const row = {
        id: data.id ?? nextId(prefix),
        createdAt: data.createdAt ?? new Date(),
        updatedAt: data.updatedAt ?? new Date(),
        ...clone(data),
      }
      rows.push(row)
      return applySelect(row, select)
    }),
    update: jest.fn(async ({ where, data, select }: { where: Record<string, unknown>; data: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const row = rows.find((candidate) => matchesWhere(candidate, where))
      if (!row) {
        throw new Error(`row not found for ${prefix}`)
      }
      Object.assign(row, clone(data), { updatedAt: new Date() })
      return applySelect(row, select)
    }),
    findFirst: jest.fn(async ({ where, orderBy, select }: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>; select?: Record<string, boolean> }) => {
      const row = applyOrder(rows.filter((candidate) => matchesWhere(candidate, where)), orderBy)[0]
      return row ? applySelect(row, select) : null
    }),
    findMany: jest.fn(async ({ where, orderBy, select, take }: { where?: Record<string, unknown>; orderBy?: Record<string, 'asc' | 'desc'> | Array<Record<string, 'asc' | 'desc'>>; select?: Record<string, boolean>; take?: number }) => {
      const ordered = applyOrder(rows.filter((candidate) => matchesWhere(candidate, where)), orderBy)
      const limited = typeof take === 'number' ? ordered.slice(0, take) : ordered
      return limited.map((row) => applySelect(row, select))
    }),
  }
}

const claimRecordModel = makeModel(state.claimRecords, 'claim')
const verificationArtifactModel = makeModel(state.verificationArtifacts, 'artifact')
const sourceRunModel = makeModel(state.sourceRuns, 'source-run')
const fetchJobModel = makeModel(state.fetchJobs, 'fetch-job')
const parseJobModel = makeModel(state.parseJobs, 'parse-job')
const claimDerivationJobModel = makeModel(state.claimDerivationJobs, 'claim-derivation-job')
const deltaDetectionJobModel = makeModel(state.deltaDetectionJobs, 'delta-job')
const alertJobModel = makeModel(state.alertJobs, 'alert-job')
const sourceRecordModel = makeModel(state.sourceRecords, 'source-record')
const verificationReceiptRecordModel = makeModel(state.verificationReceiptRecords, 'receipt-record')
const identityClaimDeltaModel = makeModel(state.identityClaimDeltas, 'claim-delta')
const trustAlertRecordModel = makeModel(state.trustAlertRecords, 'trust-alert')
const watchlistModel = makeModel(state.watchlists, 'watchlist')
const entityChangeEventModel = makeModel(state.entityChangeEvents, 'entity-change')
const sourceStalenessEventModel = makeModel(state.sourceStalenessEvents, 'source-staleness')
const trustDegradationEventModel = makeModel(state.trustDegradationEvents, 'trust-degradation')
const watchlistHitModel = makeModel(state.watchlistHits, 'watchlist-hit')
const alertDeliveryAttemptModel = makeModel(state.alertDeliveryAttempts, 'alert-delivery')
const identityResolutionDecisionModel = makeModel(state.identityResolutionDecisions, 'resolution')
const auditEventModel = makeModel(state.auditEvents, 'audit')

const prismaMock = {
  sourceRun: sourceRunModel,
  fetchJob: fetchJobModel,
  parseJob: parseJobModel,
  claimDerivationJob: claimDerivationJobModel,
  deltaDetectionJob: deltaDetectionJobModel,
  alertJob: alertJobModel,
  sourceRecord: sourceRecordModel,
  verificationArtifact: verificationArtifactModel,
  claimRecord: {
    ...claimRecordModel,
    findFirst: jest.fn(async ({ where, select }: { where?: Record<string, unknown>; select?: Record<string, boolean> }) => {
      const row = state.claimRecords.find((candidate) => matchesWhere(candidate, where))
      return row ? applySelect(row, select) : null
    }),
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const duplicate = state.claimRecords.find((candidate) =>
        candidate.claimId === data.claimId
        && candidate.verificationArtifactId === data.verificationArtifactId,
      )

      if (duplicate) {
        const error = Object.assign(new Error('duplicate'), { code: 'P2002' })
        throw error
      }

      const row = {
        id: nextId('claim'),
        createdAt: new Date(),
        ...clone(data),
      }
      state.claimRecords.push(row)
      return { id: row.id }
    }),
  },
  verificationReceiptRecord: {
    ...verificationReceiptRecordModel,
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const duplicate = state.verificationReceiptRecords.find(
        (candidate) => candidate.receiptId === data.receiptId,
      )
      if (duplicate) {
        const error = Object.assign(new Error('duplicate'), { code: 'P2002' })
        throw error
      }

      const row = {
        id: nextId('receipt-record'),
        createdAt: new Date(),
        issuedAt: data.issuedAt ?? new Date(),
        ...clone(data),
      }
      state.verificationReceiptRecords.push(row)
      return { id: row.id }
    }),
  },
  identityClaimDelta: {
    ...identityClaimDeltaModel,
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const duplicate = state.identityClaimDeltas.find(
        (candidate) => candidate.checksum === data.checksum,
      )
      if (duplicate) {
        const error = Object.assign(new Error('duplicate'), { code: 'P2002' })
        throw error
      }

      const row = {
        id: nextId('claim-delta'),
        createdAt: new Date(),
        ...clone(data),
      }
      state.identityClaimDeltas.push(row)
      return { id: row.id }
    }),
  },
  trustAlertRecord: {
    ...trustAlertRecordModel,
    create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
      const duplicate = state.trustAlertRecords.find(
        (candidate) => candidate.alertId === data.alertId,
      )
      if (duplicate) {
        const error = Object.assign(new Error('duplicate'), { code: 'P2002' })
        throw error
      }

      const row: Record<string, unknown> & { id: string; alertId: string } = {
        id: nextId('trust-alert'),
        createdAt: new Date(),
        alertId: String(data.alertId),
        ...clone(data),
      }
      state.trustAlertRecords.push(row)
      return { id: row.id, alertId: row.alertId }
    }),
  },
  watchlist: watchlistModel,
  entityChangeEvent: entityChangeEventModel,
  sourceStalenessEvent: sourceStalenessEventModel,
  trustDegradationEvent: trustDegradationEventModel,
  watchlistHit: watchlistHitModel,
  alertDeliveryAttempt: alertDeliveryAttemptModel,
  identityResolutionDecision: identityResolutionDecisionModel,
  auditEvent: auditEventModel,
  personProfile: {
    update: jest.fn(),
  },
}

const mockMaterializeClaimsToVcvCredentials = jest.fn()
const mockLeieLookupProvider = jest.fn()

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
  Prisma: {},
}))

jest.mock('../src/obs/logger', () => ({
  log: jest.fn(),
}))

jest.mock('../src/services/entity/vcvCredentialMaterializer', () => ({
  materializeClaimsToVcvCredentials: (...args: unknown[]) => mockMaterializeClaimsToVcvCredentials(...args),
}))

jest.mock('../src/services/identity/leieCache', () => ({
  lookupProvider: (...args: unknown[]) => mockLeieLookupProvider(...args),
}))

import {
  getClaimsForNpi,
  ingestClinicianIdentity,
  getVerificationReceiptsForNpi,
} from '../src/services/identity/identityIngestionPipeline'
import {
  getWatchtowerState,
  registerWatchlist,
} from '../src/services/identity/watchtowerEngine'

function mockJsonResponse(body: unknown, headers?: Record<string, string>): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json', ...(headers ?? {}) }),
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response
}

function buildNppesFixture(specialtyDescription = 'Family Medicine'): Record<string, unknown> {
  return {
    result_count: 1,
    results: [
      {
        number: '1558302470',
        enumeration_type: 'NPI-1',
        basic: {
          first_name: 'Ada',
          last_name: 'Lovelace',
          status: 'A',
          credential: 'MD',
          enumeration_date: '2016-04-01',
          last_updated: '2026-03-01',
        },
        taxonomies: [
          {
            code: specialtyDescription === 'Internal Medicine' ? '207R00000X' : '207Q00000X',
            desc: specialtyDescription,
            primary: true,
            state: 'CA',
            license: 'CA-12345',
          },
        ],
        addresses: [
          {
            address_1: '123 Main St',
            city: 'San Francisco',
            state: 'CA',
            postal_code: '94107',
            country_code: 'US',
            address_purpose: 'LOCATION',
          },
        ],
        endpoints: [],
      },
    ],
  }
}

function buildOigFixture(excluded = false): Record<string, unknown> {
  return {
    matchType: excluded ? 'EXACT' : 'NONE',
    excluded,
    exclusionType: excluded ? 'MANDATORY_EXCLUSION' : null,
    exclusionDate: excluded ? '2026-03-14' : null,
    reinstatementDate: null,
    waiverState: null,
  }
}

let nppesFixture = buildNppesFixture()
let oigFixture = buildOigFixture()
let pecosFixture: Array<Record<string, unknown>> = [
  {
    ENRLMT_CLSFCTN_TYPE_DESC: 'Physician',
    GNDR_CD: 'F',
  },
]

function installFetchFixture(): void {
  global.fetch = jest.fn(async (input: string | URL) => {
    const url = String(input)

    if (url.includes('npiregistry.cms.hhs.gov')) {
      return mockJsonResponse(nppesFixture)
    }

    if (url.includes('oig.hhs.gov')) {
      return mockJsonResponse(oigFixture)
    }

    if (url.includes('data.cms.gov')) {
      return mockJsonResponse(pecosFixture, { 'last-modified': 'Mon, 23 Mar 2026 02:09:21 GMT' })
    }

    throw new Error(`Unexpected URL: ${url}`)
  }) as jest.Mock
}

function buildLeieLookupResult(): Record<string, unknown> {
  const excluded = Boolean(oigFixture.excluded)
  return {
    npi: '1558302470',
    excluded,
    entry: excluded
      ? {
          npi: '1558302470',
          exclusionType: oigFixture.exclusionType ?? 'MANDATORY_EXCLUSION',
          exclusionDate: oigFixture.exclusionDate ?? '2026-03-14',
          reinstatementDate: oigFixture.reinstatementDate ?? null,
          waiverState: oigFixture.waiverState ?? null,
        }
      : null,
    matchedEntries: excluded ? [{ npi: '1558302470' }] : [],
    source: 'LEIE_CSV',
    checkedAt: '2026-03-14T12:00:00.000Z',
    cacheAge: 'fresh',
    verdict: excluded ? 'EXCLUDED' : 'CLEAR',
    matchType: excluded ? 'EXACT' : 'NONE',
    matchConfidence: 'HIGH',
    matchScore: 1,
    matchedFields: ['npi'],
    dataVersion: '2026-03',
    leieVersionDate: '2026-03-10',
    sourceLatency: 'MONTHLY',
  }
}

describe('identity ingestion pipeline hardening', () => {
  beforeEach(() => {
    resetState()
    jest.useFakeTimers().setSystemTime(new Date('2026-03-14T12:00:00.000Z'))
    jest.clearAllMocks()
    mockMaterializeClaimsToVcvCredentials.mockResolvedValue({ credentialIds: [] })
    mockLeieLookupProvider.mockImplementation(async () => buildLeieLookupResult())
    nppesFixture = buildNppesFixture()
    oigFixture = buildOigFixture()
    pecosFixture = [
      {
        ENRLMT_CLSFCTN_TYPE_DESC: 'Physician',
        GNDR_CD: 'F',
      },
    ]
    installFetchFixture()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('keeps PersonProfile free of dynamic metadata and stores identity index in VerificationArtifact', async () => {
    const report = await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(report.sourcesFailed).toBe(0)
    expect(mockMaterializeClaimsToVcvCredentials).toHaveBeenCalledTimes(1)
    expect(report.results[0]?.credentialIds).toEqual([])
    expect(prismaMock.personProfile.update).not.toHaveBeenCalled()

    const identityIndexArtifact = state.verificationArtifacts.find(
      (artifact) => artifact.source === 'IDENTITY_INDEX',
    )
    expect(identityIndexArtifact).toMatchObject({
      source: 'IDENTITY_INDEX',
      artifactType: 'IDENTITY_INDEX',
      parserVersion: 'identity-index/v1',
    })
  })

  test('records merge provenance when authoritative source records are resolved together', async () => {
    await ingestClinicianIdentity('1558302470', ['NPPES_API', 'OIG_LEIE'])

    expect(state.identityResolutionDecisions).toHaveLength(1)
    expect(state.identityResolutionDecisions[0]).toMatchObject({
      subjectNpi: '1558302470',
      decisionType: 'MERGE',
      matchingStrategy: 'NPI_EXACT',
    })

    const payload = state.identityResolutionDecisions[0].payload as {
      sourceRecordIds: string[]
      claimRefs: string[]
      identityIndexArtifactId: string
    }
    expect(payload.sourceRecordIds).toHaveLength(2)
    expect(payload.claimRefs.length).toBeGreaterThan(0)
    expect(payload.identityIndexArtifactId).toBe(
      state.verificationArtifacts.find((artifact) => artifact.source === 'IDENTITY_INDEX')?.id,
    )
  })

  test('reuses source captures on re-resolution while keeping claim replay stable', async () => {
    const first = await ingestClinicianIdentity('1558302470', ['NPPES_API', 'OIG_LEIE'])
    const firstClaims = await getClaimsForNpi('1558302470')
    const firstSourceCaptureCount = state.verificationArtifacts.filter(
      (artifact) => artifact.artifactType === 'SOURCE_CAPTURE',
    ).length
    const firstSourceRecordCount = state.sourceRecords.length

    const second = await ingestClinicianIdentity('1558302470', ['NPPES_API', 'OIG_LEIE'])
    const secondClaims = await getClaimsForNpi('1558302470')

    expect(second.results.map((result) => result.artifactId)).toEqual(
      first.results.map((result) => result.artifactId),
    )
    expect(secondClaims.map((claim) => claim.claimId)).toEqual(
      firstClaims.map((claim) => claim.claimId),
    )
    expect(
      state.verificationArtifacts.filter((artifact) => artifact.artifactType === 'SOURCE_CAPTURE').length,
    ).toBe(firstSourceCaptureCount)
    expect(state.sourceRecords).toHaveLength(firstSourceRecordCount)
    expect(
      state.verificationArtifacts.filter((artifact) => artifact.source === 'IDENTITY_INDEX').length,
    ).toBe(2)
  })

  test('supersedes stale claims without data loss and keeps only current values active', async () => {
    await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    nppesFixture = buildNppesFixture('Internal Medicine')

    const report = await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(report.deltaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'CLAIM_CHANGED',
          claimType: 'SPECIALTY',
        }),
      ]),
    )
    expect(state.identityClaimDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimType: 'SPECIALTY',
          deltaType: 'CLAIM_CHANGED',
        }),
      ]),
    )

    const specialtyClaimRecords = state.claimRecords.filter(
      (claim) => claim.claimType === 'SPECIALTY',
    )
    expect(specialtyClaimRecords).toHaveLength(2)

    const superseded = specialtyClaimRecords.find((claim) => claim.status === 'SUPERSEDED')
    const active = specialtyClaimRecords.find((claim) => claim.status === 'ACTIVE')

    expect(superseded?.supersededByClaimId).toBe(active?.claimId)
    expect(active?.supersedesClaimId).toBe(superseded?.claimId)

    const currentClaims = await getClaimsForNpi('1558302470')
    const activeSpecialties = currentClaims.filter((claim) => claim.claimType === 'SPECIALTY')
    expect(activeSpecialties).toHaveLength(1)
    expect(
      (activeSpecialties[0]?.value as { taxonomyDescription?: string }).taxonomyDescription,
    ).toBe('Internal Medicine')
  })

  test('persists critical exclusion deltas as trust alerts with artifact lineage', async () => {
    await ingestClinicianIdentity('1558302470', ['OIG_LEIE'])

    oigFixture = buildOigFixture(true)

    const report = await ingestClinicianIdentity('1558302470', ['OIG_LEIE'])

    expect(report.deltaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'NEW_SANCTION_HIT',
          claimType: 'EXCLUSION_STATUS',
          severity: 'CRITICAL',
        }),
      ]),
    )
    expect(state.identityClaimDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimType: 'EXCLUSION_STATUS',
          deltaType: 'NEW_SANCTION_HIT',
          severity: 'CRITICAL',
        }),
      ]),
    )
    expect(state.trustAlertRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'credential_revoked',
          severity: 'CRITICAL',
          subject: '1558302470',
          verificationArtifactId: report.results[0]?.artifactId,
          identityDeltaId: state.identityClaimDeltas[0]?.id,
        }),
      ]),
    )
  })

  test('detects stale sources and raises source-stale trust events without duplicate spam', async () => {
    await ingestClinicianIdentity('1558302470', ['OIG_LEIE'])

    jest.setSystemTime(new Date('2026-03-18T12:00:00.000Z'))
    const report = await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(report.deltaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'SOURCE_STALE',
          claimType: 'SOURCE_CAPTURE',
          severity: 'HIGH',
        }),
      ]),
    )
    expect(state.sourceStalenessEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: 'OIG_LEIE',
          status: 'STALE',
          severity: 'HIGH',
        }),
      ]),
    )
    expect(state.trustDegradationEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reason: 'SOURCE_STALE',
          severity: 'HIGH',
        }),
      ]),
    )

    const alertCountAfterFirstStale = state.trustAlertRecords.filter(
      (alert) => alert.type === 'source_stale',
    ).length

    await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(
      state.trustAlertRecords.filter((alert) => alert.type === 'source_stale'),
    ).toHaveLength(alertCountAfterFirstStale)
  })

  test('matches provider watchlists, emits delivery attempts, and stays stable on rerun', async () => {
    await registerWatchlist({
      name: 'Ada monitor',
      targetType: 'PROVIDER',
      targetValue: '1558302470',
      deliveryChannels: ['INTERNAL_FEED', 'WEBHOOK'],
      webhookUrl: 'https://ops.vitalcv.test/watchtower',
    })

    await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    nppesFixture = buildNppesFixture('Family Medicine')
    ;(nppesFixture.results as Array<Record<string, unknown>>)[0]!.addresses = [
      {
        address_1: '456 Mission St',
        city: 'Oakland',
        state: 'CA',
        postal_code: '94612',
        country_code: 'US',
        address_purpose: 'LOCATION',
      },
    ]

    const report = await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(report.deltaEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'PROVIDER_MOVED_LOCATION',
          claimType: 'PRACTICE_LOCATION',
          severity: 'MEDIUM',
          fieldPath: 'address1',
        }),
      ]),
    )
    expect(state.entityChangeEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'PROVIDER_MOVED_LOCATION',
          claimType: 'PRACTICE_LOCATION',
        }),
      ]),
    )
    expect(state.watchlistHits).toHaveLength(1)
    expect(state.alertDeliveryAttempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          channel: 'WEBHOOK',
          status: 'PENDING',
          destination: 'https://ops.vitalcv.test/watchtower',
        }),
      ]),
    )

    const beforeRerun = {
      entityChangeEvents: state.entityChangeEvents.length,
      watchlistHits: state.watchlistHits.length,
      alertDeliveryAttempts: state.alertDeliveryAttempts.length,
    }

    await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    expect(state.entityChangeEvents).toHaveLength(beforeRerun.entityChangeEvents)
    expect(state.watchlistHits).toHaveLength(beforeRerun.watchlistHits)
    expect(state.alertDeliveryAttempts).toHaveLength(beforeRerun.alertDeliveryAttempts)

    const watchtowerState = await getWatchtowerState('1558302470')
    expect(watchtowerState.entityChangeEvents).toHaveLength(1)
    expect(watchtowerState.watchlistHits).toHaveLength(1)
  })

  test('quarantines a failed derivation after raw capture without corrupting existing identity state', async () => {
    await ingestClinicianIdentity('1558302470', ['NPPES_API'])

    ;(prismaMock.claimRecord.create as jest.Mock).mockRejectedValueOnce(new Error('schema drift'))

    const report = await ingestClinicianIdentity('1558302470', ['PECOS_PUBLIC'])

    expect(report.results[0]?.status).toBe('FAILED')
    expect(state.sourceRuns.at(-1)).toMatchObject({
      status: 'QUARANTINED',
      quarantineReason: 'schema drift',
    })
    expect(
      [...state.verificationArtifacts]
        .reverse()
        .find((artifact) => artifact.source === 'PECOS_PUBLIC'),
    ).toMatchObject({
      source: 'PECOS_PUBLIC',
      status: 'QUARANTINED',
      lifecycleState: 'quarantined',
    })

    const receipts = await getVerificationReceiptsForNpi('1558302470')
    expect(receipts.length).toBeGreaterThan(0)
  })

  test('queries the single-provider PECOS endpoint and stamps the quarterly refresh contract once', async () => {
    await ingestClinicianIdentity('1558302470', ['PECOS_PUBLIC'])

    expect(global.fetch).toHaveBeenCalledWith(
      'https://data.cms.gov/data-api/v1/dataset/2457ea29-fc82-48b0-86ec-3b0755de7515/data?filter%5BNPI%5D=1558302470&size=5',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    )

    const pecosArtifact = [...state.verificationArtifacts]
      .reverse()
      .find((artifact) => artifact.source === 'PECOS_PUBLIC')
    const rawPayload = pecosArtifact?.rawPayload as Record<string, unknown> | undefined

    expect(rawPayload?.dataVersion).toBe('2026-Q1')
    expect(rawPayload?.revalidationDue).toBe('2026-06-12T12:00:00.000Z')
  })

  test('marks PECOS not-found captures as quarterly NOT_FOUND evidence instead of active enrollment', async () => {
    pecosFixture = []

    const report = await ingestClinicianIdentity('1558302470', ['PECOS_PUBLIC'])

    expect(report.results[0]?.status).toBe('SKIPPED')
    expect(
      [...state.verificationArtifacts]
        .reverse()
        .find((artifact) => artifact.source === 'PECOS_PUBLIC'),
    ).toMatchObject({
      source: 'PECOS_PUBLIC',
      status: 'NOT_FOUND',
    })

    const enrollmentClaim = state.claimRecords.find((claim) => claim.claimType === 'ENROLLMENT_STATUS')
    expect((enrollmentClaim?.value as Record<string, unknown>).enrolled).toBe(false)
    expect((enrollmentClaim?.value as Record<string, unknown>).dataFreshness).toBe('QUARTERLY')
    expect((enrollmentClaim?.value as Record<string, unknown>).label).toBe(
      'Medicare enrollment not found in quarterly PECOS snapshot — as of Q1 2026',
    )
  })
})
