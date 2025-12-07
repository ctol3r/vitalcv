export type CommitteePacketStatus = 'DRAFT' | 'FROZEN' | 'SUBMITTED'

export interface CommitteePacketSectionField {
  label: string
  value: string
  detail?: string
}

export interface CommitteePacketTable {
  columns: string[]
  rows: Array<Array<string>>
  caption?: string
}

export interface CommitteeTimelineEntry {
  id: string
  title: string
  description: string
  occurredAt: string
  tone?: 'positive' | 'warning' | 'risk'
}

export interface CommitteeRiskExposure {
  id: string
  label: string
  severity: 'low' | 'medium' | 'high'
  owner: string
  recommendation: string
}

export interface CommitteeNarrativeSection {
  id: string
  title: string
  summary: string
  bulletPoints: string[]
  sentiment?: 'positive' | 'neutral' | 'warning' | 'critical'
}

export interface CommitteePacketSection {
  id: string
  title: string
  summary: string
  fields?: CommitteePacketSectionField[]
  table?: CommitteePacketTable
  notes?: string[]
  timeline?: CommitteeTimelineEntry[]
  risks?: CommitteeRiskExposure[]
}

import type { Buffer } from 'node:buffer'

export interface CommitteeEvidenceArtifact {
  id: string
  name: string
  source: string
  capturedAt: string
  contentType: string
  buffer: Buffer
}

export interface CommitteePacket {
  id: string
  clinicianId: string
  clinicianName: string
  credentialId: string
  facility: string
  generatedAt: string
  status: CommitteePacketStatus
  sections: CommitteePacketSection[]
  timeline: CommitteeTimelineEntry[]
  risks: CommitteeRiskExposure[]
  aiSummary?: {
    updatedAt: string
    sections: CommitteeNarrativeSection[]
  }
}


