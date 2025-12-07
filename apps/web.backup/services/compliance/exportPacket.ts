import crypto from 'node:crypto'
import type { Buffer } from 'node:buffer'

import type { SelfCheckReport, CheckFinding } from '../../jobs/ncqaSelfCheck'
import { exportCommitteePacketPdf, type CommitteePacketPdfOptions } from '../committeePacket/pdfExport'
import type { CommitteePacket, CommitteePacketSection, CommitteeTimelineEntry } from '../committeePacket/types'

export type ComplianceStatus = 'PASS' | 'WARN' | 'FAIL'

export interface FrameworkRuleStatus {
  id: string
  name: string
  framework: 'NCQA' | 'TJC'
  element: string
  status: ComplianceStatus
  target: string
  actual: string
  complianceRate?: number
  notes?: string
  affectedClinicians?: string[]
  updatedAt: string
}

export interface ClinicianComplianceSnapshot {
  clinicianId: string
  clinicianName: string
  department?: string
  statuses: Record<'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5' | 'TJC', ComplianceStatus>
  overduePsv?: number
  missingEvidence?: string[]
  lastUpdated: string
}

export interface ComplianceAuditPacket {
  packetId: string
  generatedAt: string
  org: {
    id: string
    name: string
  }
  summary: {
    pass: number
    warn: number
    fail: number
    totalRules: number
    ncqaComplianceRate: number
  }
  ncqa: FrameworkRuleStatus[]
  tjc: FrameworkRuleStatus[]
  clinicians: ClinicianComplianceSnapshot[]
  attachments: Array<{
    clinicianId: string
    packetId: string
    filename: string
    status: string
  }>
  metadata: {
    hash: string
    source: 'services/compliance/exportPacket'
  }
}

export interface ComplianceExportPacketOptions {
  orgId: string
  orgName: string
  ncqaReport: SelfCheckReport
  tjcFindings?: FrameworkRuleStatus[]
  clinicianSnapshots?: ClinicianComplianceSnapshot[]
  committeePackets?: CommitteePacket[]
  pdfOptions?: CommitteePacketPdfOptions
}

export interface ComplianceExportPacketResult {
  manifest: ComplianceAuditPacket
  pdf: {
    buffer: Buffer
    filename: string
    contentType: 'application/pdf'
  }
  committeeAttachments: Array<{
    clinicianId: string
    packetId: string
    filename: string
    buffer: Buffer
  }>
}

type CommitteeAttachment = {
  clinicianId: string
  packetId: string
  filename: string
  buffer: Buffer
  status: string
}

export async function generateComplianceAuditPacket(options: ComplianceExportPacketOptions): Promise<ComplianceExportPacketResult> {
  const generatedAt = new Date().toISOString()
  const packetId = `compliance-${options.orgId}-${Date.now()}`

  const ncqaStatuses = normalizeNcqaFindings(options.ncqaReport)
  const tjcStatuses = normalizeTjcFindings(options.tjcFindings)
  const summary = computeSummary([...ncqaStatuses, ...tjcStatuses])

  const manifestWithoutHash: Omit<ComplianceAuditPacket, 'metadata'> = {
    packetId,
    generatedAt,
    org: { id: options.orgId, name: options.orgName },
    summary,
    ncqa: ncqaStatuses,
    tjc: tjcStatuses,
    clinicians: options.clinicianSnapshots ?? [],
    attachments: [],
  }

  const attachments = await renderCommitteeAttachments(options.committeePackets)
  manifestWithoutHash.attachments = attachments.map((attachment) => ({
    clinicianId: attachment.clinicianId,
    packetId: attachment.packetId,
    filename: attachment.filename,
    status: attachment.status,
  }))

  const manifest: ComplianceAuditPacket = {
    ...manifestWithoutHash,
    metadata: {
      hash: computeHash(manifestWithoutHash),
      source: 'services/compliance/exportPacket',
    },
  }

  const committeePacket = buildCommitteeStylePacket(manifest)
  const pdf = await exportCommitteePacketPdf(committeePacket, {
    watermark: 'NCQA • TJC',
    ...options.pdfOptions,
  })

  return {
    manifest,
    pdf: {
      buffer: pdf.buffer,
      filename: pdf.filename,
      contentType: pdf.contentType,
    },
    committeeAttachments: attachments,
  }
}

function normalizeNcqaFindings(report: SelfCheckReport): FrameworkRuleStatus[] {
  return report.findings.map((finding) => normalizeFinding(finding, 'NCQA'))
}

function normalizeTjcFindings(findings?: FrameworkRuleStatus[]): FrameworkRuleStatus[] {
  if (!findings || findings.length === 0) {
    return []
  }
  return findings.map((finding) => ({
    ...finding,
    framework: 'TJC',
  }))
}

function normalizeFinding(finding: CheckFinding, framework: FrameworkRuleStatus['framework']): FrameworkRuleStatus {
  return {
    id: finding.checkId,
    name: finding.checkName,
    framework,
    element: finding.element,
    status: finding.status === 'WARNING' ? 'WARN' : finding.status,
    target: finding.target,
    actual: finding.actual,
    complianceRate: finding.complianceRate,
    notes: finding.gap ?? finding.remediation,
    affectedClinicians: finding.affectedProviders,
    updatedAt: new Date().toISOString(),
  }
}

function computeSummary(rules: FrameworkRuleStatus[]) {
  const summary = {
    pass: 0,
    warn: 0,
    fail: 0,
    totalRules: rules.length,
    ncqaComplianceRate: 100,
  }

  for (const rule of rules) {
    if (rule.status === 'FAIL') {
      summary.fail += 1
    } else if (rule.status === 'WARN') {
      summary.warn += 1
    } else {
      summary.pass += 1
    }
  }

  const ncqaRules = rules.filter((rule) => rule.framework === 'NCQA')
  if (ncqaRules.length > 0) {
    const passing = ncqaRules.filter((rule) => rule.status === 'PASS')
    summary.ncqaComplianceRate = Math.round((passing.length / ncqaRules.length) * 100)
  }

  return summary
}

function computeHash(data: Omit<ComplianceAuditPacket, 'metadata'>): string {
  const canonical = JSON.stringify(data, Object.keys(data).sort())
  return crypto.createHash('sha256').update(canonical).digest('hex')
}

async function renderCommitteeAttachments(packets?: CommitteePacket[]): Promise<CommitteeAttachment[]> {
  if (!packets || packets.length === 0) {
    return []
  }

  const exports: CommitteeAttachment[] = []
  for (const packet of packets) {
    const pdf = await exportCommitteePacketPdf(packet, { watermark: 'Committee Packet' })
    exports.push({
      clinicianId: packet.clinicianId,
      packetId: packet.id,
      filename: pdf.filename,
      buffer: pdf.buffer,
      status: packet.status,
    })
  }
  return exports
}

function buildCommitteeStylePacket(manifest: ComplianceAuditPacket): CommitteePacket {
  const now = manifest.generatedAt
  const timeline: CommitteeTimelineEntry[] = manifest.ncqa.slice(0, 4).map((rule) => ({
    id: `${rule.id}-${rule.status}`,
    title: `${rule.framework} ${rule.element}`,
    description: rule.notes ?? `Status ${rule.status}`,
    occurredAt: now,
    tone: rule.status === 'FAIL' ? 'risk' : rule.status === 'WARN' ? 'warning' : 'positive',
  }))

  const sections: CommitteePacketSection[] = [
    {
      id: 'ncqa',
      title: 'NCQA CR1-CR5 status',
      summary: `${manifest.summary.ncqaComplianceRate}% compliance across ${manifest.ncqa.length} automated checks`,
      table: {
        columns: ['Requirement', 'Status', 'Actual', 'Target'],
        rows: manifest.ncqa.map((rule) => [
          `${rule.element} • ${rule.name}`,
          rule.status,
          rule.actual,
          rule.target,
        ]),
        caption: 'Derived from monthly NCQA self-check job',
      },
      notes: [
        `PASS: ${manifest.summary.pass}`,
        `WARN: ${manifest.summary.warn}`,
        `FAIL: ${manifest.summary.fail}`,
      ],
    },
  ]

  if (manifest.tjc.length > 0) {
    sections.push({
      id: 'tjc',
      title: 'Joint Commission readiness',
      summary: `${manifest.tjc.length} monitored clauses`,
      table: {
        columns: ['Clause', 'Status', 'Owner', 'Notes'],
        rows: manifest.tjc.map((rule) => [
          `${rule.element} • ${rule.name}`,
          rule.status,
          rule.affectedClinicians?.join(', ') ?? 'Credentialing',
          rule.notes ?? '—',
        ]),
      },
    })
  }

  if (manifest.clinicians.length > 0) {
    sections.push({
      id: 'clinicians',
      title: 'Clinician compliance roster',
      summary: 'Real-time CR1-CR5 & TJC signals',
      table: {
        columns: ['Clinician', 'Department', 'CR1', 'CR2', 'CR3', 'CR4', 'CR5', 'TJC'],
        rows: manifest.clinicians.map((clinician) => [
          clinician.clinicianName,
          clinician.department ?? '—',
          clinician.statuses.CR1,
          clinician.statuses.CR2,
          clinician.statuses.CR3,
          clinician.statuses.CR4,
          clinician.statuses.CR5,
          clinician.statuses.TJC,
        ]),
        caption: 'Statuses reflect latest PSV sync and committee packet data',
      },
    })
  }

  return {
    id: manifest.packetId,
    clinicianId: manifest.org.id,
    clinicianName: `${manifest.org.name} Compliance`,
    credentialId: manifest.packetId.toUpperCase(),
    facility: manifest.org.name,
    generatedAt: manifest.generatedAt,
    status: manifest.summary.fail > 0 ? 'SUBMITTED' : 'DRAFT',
    sections,
    timeline,
    risks: buildRiskExposures(manifest),
    aiSummary: {
      updatedAt: manifest.generatedAt,
      sections: [
        {
          id: 'ncqa-ai',
          title: 'NCQA posture',
          summary: `${manifest.summary.fail} fail / ${manifest.summary.warn} warn`,
          bulletPoints: ['Automated CR1-CR5 evidence coverage', 'PSV freshness and practitioner rights alerts'],
          sentiment: manifest.summary.fail > 0 ? 'critical' : manifest.summary.warn > 0 ? 'warning' : 'positive',
        },
      ],
    },
  }
}

function buildRiskExposures(manifest: ComplianceAuditPacket) {
  const risks = []
  for (const rule of manifest.ncqa.filter((entry) => entry.status !== 'PASS')) {
    risks.push({
      id: rule.id,
      label: `${rule.framework} ${rule.element}`,
      severity: rule.status === 'FAIL' ? 'high' : 'medium',
      owner: 'Credentialing Ops',
      recommendation: rule.notes ?? 'Review evidence and upload remediation notes',
    })
  }
  for (const rule of manifest.tjc.filter((entry) => entry.status !== 'PASS')) {
    risks.push({
      id: rule.id,
      label: `${rule.framework} ${rule.element}`,
      severity: rule.status === 'FAIL' ? 'high' : 'medium',
      owner: 'Compliance',
      recommendation: rule.notes ?? 'Attach TJC readiness evidence',
    })
  }
  return risks.slice(0, 6)
}


