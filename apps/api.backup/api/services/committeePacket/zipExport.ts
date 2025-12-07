import archiver from 'archiver'
import { PassThrough } from 'node:stream'

import { exportCommitteePacketPdf, type CommitteePacketPdfOptions } from './pdfExport'
import type { CommitteeEvidenceArtifact, CommitteePacket } from './types'

export interface CommitteePacketZipOptions {
  pdf?: CommitteePacketPdfOptions
  artifacts?: CommitteeEvidenceArtifact[]
  schemas?: Record<string, unknown>
}

export interface CommitteePacketZipResult {
  buffer: Buffer
  filename: string
  contentType: 'application/zip'
  manifest: Record<string, unknown>
}

export async function exportCommitteePacketZip(packet: CommitteePacket, options: CommitteePacketZipOptions = {}): Promise<CommitteePacketZipResult> {
  const pdf = await exportCommitteePacketPdf(packet, options.pdf)
  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = new PassThrough()
  const chunks: Buffer[] = []

  stream.on('data', (chunk) => chunks.push(chunk))
  archive.pipe(stream)

  const manifest = buildManifest(packet, options.artifacts)

  archive.append(pdf.buffer, { name: 'committee-packet.pdf' })
  archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' })
  archive.append(JSON.stringify(packet.timeline, null, 2), { name: 'timeline.json' })
  archive.append(JSON.stringify(packet.risks, null, 2), { name: 'risks.json' })

  const schemas = options.schemas ?? buildDefaultSchemas(packet)
  Object.entries(schemas).forEach(([filename, content]) => {
    archive.append(JSON.stringify(content, null, 2), { name: `schemas/${filename}.json` })
  })

  if (options.artifacts) {
    for (const artifact of options.artifacts) {
      archive.append(artifact.buffer, { name: `evidence/${sanitizeFilename(artifact.name)}`, date: new Date(artifact.capturedAt) })
    }
  }

  await archive.finalize()
  await new Promise<void>((resolve, reject) => {
    stream.on('end', () => resolve())
    stream.on('error', reject)
    archive.on('error', reject)
  })

  return {
    buffer: Buffer.concat(chunks),
    filename: `committee-packet-${packet.id}.zip`,
    contentType: 'application/zip',
    manifest,
  }
}

function buildManifest(packet: CommitteePacket, artifacts?: CommitteeEvidenceArtifact[]) {
  return {
    packetId: packet.id,
    clinicianId: packet.clinicianId,
    clinicianName: packet.clinicianName,
    credentialId: packet.credentialId,
    facility: packet.facility,
    generatedAt: packet.generatedAt,
    status: packet.status,
    sections: packet.sections.map((section) => ({
      id: section.id,
      title: section.title,
      summary: section.summary,
      fields: section.fields?.map((field) => ({
        label: field.label,
        value: field.value,
      })),
      table: section.table ? { columns: section.table.columns, rowCount: section.table.rows.length } : undefined,
    })),
    attachments: artifacts?.map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      source: artifact.source,
      contentType: artifact.contentType,
      capturedAt: artifact.capturedAt,
    })),
  }
}

function buildDefaultSchemas(packet: CommitteePacket) {
  const sectionSchema = packet.sections.reduce<Record<string, unknown>>((schema, section) => {
    schema[section.id] = {
      title: section.title,
      fields: section.fields?.map((field) => ({
        key: slugify(field.label),
        type: 'string',
        label: field.label,
      })),
      tableColumns: section.table?.columns,
    }
    return schema
  }, {})

  return {
    packet: {
      type: 'CommitteePacket',
      version: '1.0.0',
      properties: {
        id: { type: 'string' },
        clinicianId: { type: 'string' },
        generatedAt: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['DRAFT', 'FROZEN', 'SUBMITTED'] },
      },
    },
    sections: sectionSchema,
  }
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[^a-z0-9.\-_]/gi, '_')
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}


