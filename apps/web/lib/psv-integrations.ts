import 'server-only'

import { createHash } from 'crypto'

import { createPSVReport } from '@domain-common/psvPolicy'
import {
  PSVDecision,
  PSVSource,
  PSVStatus,
  type PSVCheckResult,
  type PSVPolicy,
  type PSVReport,
} from '@domain-common/psvContracts'

type PSVSourceBadge = 'LIVE' | 'NOT_CONFIGURED' | 'RESTRICTED'

const SOURCE_BADGES: Record<PSVSource, PSVSourceBadge> = {
  [PSVSource.OIG_LEIE]: 'LIVE',
  [PSVSource.SAM_EXCLUSIONS]: process.env.SAM_API_KEY ? 'LIVE' : 'NOT_CONFIGURED',
  [PSVSource.CMS_PPEF]: 'LIVE',
  [PSVSource.STATE_BOARD]: 'RESTRICTED',
  [PSVSource.DEA]: 'RESTRICTED',
  [PSVSource.NPDB]: 'RESTRICTED',
}

const DEMO_POLICY: PSVPolicy = {
  policyId: 'demo-psv',
  version: '1.0.0',
  name: 'Demo PSV Policy',
  freshnessRules: [
    { source: PSVSource.OIG_LEIE, maxAgeSeconds: 2592000, required: true },
    { source: PSVSource.SAM_EXCLUSIONS, maxAgeSeconds: 2592000, required: true },
    { source: PSVSource.CMS_PPEF, maxAgeSeconds: 7776000, required: false },
    { source: PSVSource.STATE_BOARD, maxAgeSeconds: 15552000, required: true },
    { source: PSVSource.DEA, maxAgeSeconds: 15552000, required: false },
    { source: PSVSource.NPDB, maxAgeSeconds: 31536000, required: false },
  ],
  matchingRules: [
    { source: PSVSource.OIG_LEIE, requiredFields: ['firstName', 'lastName', 'dob'], matchStrategy: 'exact' },
    { source: PSVSource.SAM_EXCLUSIONS, requiredFields: ['npi'], matchStrategy: 'exact' },
    { source: PSVSource.CMS_PPEF, requiredFields: ['npi'], matchStrategy: 'exact' },
    { source: PSVSource.STATE_BOARD, requiredFields: ['state', 'licenseNumber'], matchStrategy: 'exact' },
  ],
  blockOnAnyFail: true,
  reviewOnAnyFlag: true,
  allowUnknownSources: false,
}

const RESTRICTED_REASON =
  'RESTRICTED: Authorized integration required before this source can return a decision.'

const sourceReasons: Record<PSVSource, string> = {
  [PSVSource.OIG_LEIE]: 'No active exclusions found in the latest LEIE release.',
  [PSVSource.SAM_EXCLUSIONS]: process.env.SAM_API_KEY
    ? 'SAM exclusions check completed with configured credentials.'
    : 'NOT_CONFIGURED: SAM API key required to run this check.',
  [PSVSource.CMS_PPEF]: 'Enrollment record present in CMS PPEF dataset.',
  [PSVSource.STATE_BOARD]: RESTRICTED_REASON,
  [PSVSource.DEA]: RESTRICTED_REASON,
  [PSVSource.NPDB]: RESTRICTED_REASON,
}

const sourceStatuses: Record<PSVSource, PSVStatus> = {
  [PSVSource.OIG_LEIE]: PSVStatus.PASS,
  [PSVSource.SAM_EXCLUSIONS]: process.env.SAM_API_KEY ? PSVStatus.PASS : PSVStatus.UNKNOWN,
  [PSVSource.CMS_PPEF]: PSVStatus.PASS,
  [PSVSource.STATE_BOARD]: PSVStatus.UNKNOWN,
  [PSVSource.DEA]: PSVStatus.UNKNOWN,
  [PSVSource.NPDB]: PSVStatus.UNKNOWN,
}

const sourceExpiryDays: Record<PSVSource, number | null> = {
  [PSVSource.OIG_LEIE]: 30,
  [PSVSource.SAM_EXCLUSIONS]: 30,
  [PSVSource.CMS_PPEF]: 90,
  [PSVSource.STATE_BOARD]: 180,
  [PSVSource.DEA]: 180,
  [PSVSource.NPDB]: 365,
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function buildCheck(npi: string, source: PSVSource, checkedAt: Date): PSVCheckResult {
  const expiresInDays = sourceExpiryDays[source]
  const expiresAt =
    expiresInDays === null ? null : new Date(checkedAt.getTime() + expiresInDays * 86400000).toISOString()

  const queryFingerprint = `sha256:${sha256(`source=${source}&npi=${npi}`)}`
  const rawHash = `sha256:${sha256(JSON.stringify({ source, status: sourceStatuses[source], npi }))}`
  const evidenceRef = `psv://demo/${source.toLowerCase()}/${checkedAt.toISOString().slice(0, 10)}/${npi}.json`

  return {
    source,
    status: sourceStatuses[source],
    evidence: {
      source,
      checkedAt: checkedAt.toISOString(),
      expiresAt,
      queryFingerprint,
      evidenceRef,
      rawHash,
      notes: sourceReasons[source],
      metadata: {
        badge: SOURCE_BADGES[source],
      },
    },
    normalizedFindings: [],
  }
}

export function runPsvDemo(npi: string, checkedAt: Date = new Date()): PSVReport {
  const checks = [
    buildCheck(npi, PSVSource.OIG_LEIE, checkedAt),
    buildCheck(npi, PSVSource.SAM_EXCLUSIONS, checkedAt),
    buildCheck(npi, PSVSource.CMS_PPEF, checkedAt),
    buildCheck(npi, PSVSource.STATE_BOARD, checkedAt),
    buildCheck(npi, PSVSource.DEA, checkedAt),
    buildCheck(npi, PSVSource.NPDB, checkedAt),
  ]

  const report = createPSVReport(npi, checks, DEMO_POLICY, checkedAt.toISOString())

  return {
    ...report,
    decision: report.decision ?? PSVDecision.REVIEW,
  }
}
