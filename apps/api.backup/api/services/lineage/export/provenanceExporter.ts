/**
 * B228C-LIN-015: ProvenanceExport Tool
 *
 * Exports lineage data for a record or group of records into a signed, portable file
 * (e.g., JSON-LD or PDF); embeds provenance audit signatures.
 */

import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'

export interface ProvenanceExportOptions {
  recordIds: string[]
  format: 'json-ld' | 'pdf'
  includeSignatures?: boolean
  outputPath?: string
}

export interface ProvenanceData {
  records: Array<{
    recordId: string
    sourceSystem: string
    lineage: Array<{
      transformationId: string
      transformationName: string
      timestamp: Date
      operationType: 'CREATE' | 'UPDATE' | 'DELETE'
      metadata?: Record<string, unknown>
    }>
  }>
  signatures: Array<{
    recordId: string
    hash: string
    timestamp: Date
    signer?: string
  }>
  metadata: {
    exportDate: Date
    version: string
    format: string
  }
}

export class ProvenanceExporter {
  constructor(private prisma: PrismaClient) {}

  /**
   * Export lineage data for records
   */
  async exportProvenance(options: ProvenanceExportOptions): Promise<string> {
    const { recordIds, format, includeSignatures = true, outputPath } = options

    // Fetch lineage data from database
    const lineageData = await this.fetchLineageData(recordIds)

    // Generate signatures if requested
    if (includeSignatures) {
      lineageData.signatures = await this.generateSignatures(recordIds)
    }

    // Export in requested format
    let exportContent: string
    let fileExtension: string

    if (format === 'json-ld') {
      exportContent = await this.exportAsJSONLD(lineageData)
      fileExtension = 'jsonld'
    } else {
      exportContent = await this.exportAsPDF(lineageData)
      fileExtension = 'pdf'
    }

    // Write to file if output path provided
    if (outputPath) {
      const fullPath = path.join(outputPath, `provenance-export-${Date.now()}.${fileExtension}`)
      await fs.writeFile(fullPath, exportContent, 'utf-8')
      return fullPath
    }

    return exportContent
  }

  /**
   * Fetch lineage data for records
   */
  private async fetchLineageData(recordIds: string[]): Promise<ProvenanceData> {
    const records = await Promise.all(
      recordIds.map(async (recordId) => {
        // Fetch lineage entries for this record
        const lineageEntries = await this.prisma.dataLineage.findMany({
          where: {
            OR: [
              { sourceRecordId: recordId },
              { targetRecordId: recordId },
            ],
          },
          include: {
            transformation: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        })

        // Get source system from first entry
        const sourceSystem =
          lineageEntries.length > 0 ? lineageEntries[0].sourceSystem : 'unknown'

        return {
          recordId,
          sourceSystem,
          lineage: lineageEntries.map((entry) => ({
            transformationId: entry.transformationId || 'unknown',
            transformationName: entry.transformation?.name || 'Unknown Transformation',
            timestamp: entry.timestamp,
            operationType: entry.operationType,
            metadata: entry.metadata as Record<string, unknown> | undefined,
          })),
        }
      })
    )

    return {
      records,
      signatures: [],
      metadata: {
        exportDate: new Date(),
        version: '1.0.0',
        format: 'provenance-export',
      },
    }
  }

  /**
   * Generate audit signatures for records
   */
  private async generateSignatures(recordIds: string[]): Promise<ProvenanceData['signatures']> {
    const signatures = await Promise.all(
      recordIds.map(async (recordId) => {
        // Fetch all lineage entries for this record
        const entries = await this.prisma.dataLineage.findMany({
          where: {
            OR: [
              { sourceRecordId: recordId },
              { targetRecordId: recordId },
            ],
          },
          orderBy: {
            timestamp: 'asc',
          },
        })

        // Create a hash of all lineage entries
        const dataToSign = JSON.stringify({
          recordId,
          entries: entries.map((e) => ({
            id: e.id,
            timestamp: e.timestamp.toISOString(),
            operationType: e.operationType,
            transformationId: e.transformationId,
          })),
        })

        const hash = crypto.createHash('sha256').update(dataToSign).digest('hex')

        return {
          recordId,
          hash,
          timestamp: new Date(),
        }
      })
    )

    return signatures
  }

  /**
   * Export as JSON-LD format
   */
  private async exportAsJSONLD(data: ProvenanceData): Promise<string> {
    const jsonLd = {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        prov: 'http://www.w3.org/ns/prov#',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
        id: '@id',
        type: '@type',
        wasGeneratedBy: {
          '@id': 'prov:wasGeneratedBy',
          '@type': '@id',
        },
        wasDerivedFrom: {
          '@id': 'prov:wasDerivedFrom',
          '@type': '@id',
        },
        used: {
          '@id': 'prov:used',
          '@type': '@id',
        },
        wasAttributedTo: {
          '@id': 'prov:wasAttributedTo',
          '@type': '@id',
        },
        startedAtTime: {
          '@id': 'prov:startedAtTime',
          '@type': 'xsd:dateTime',
        },
        endedAtTime: {
          '@id': 'prov:endedAtTime',
          '@type': 'xsd:dateTime',
        },
      },
      '@graph': data.records.flatMap((record) => {
        const graph: any[] = []

        // Record entity
        graph.push({
          '@id': `record:${record.recordId}`,
          '@type': 'prov:Entity',
          'rdfs:label': `Record ${record.recordId}`,
        })

        // Lineage activities
        record.lineage.forEach((lineage, index) => {
          const activityId = `activity:${record.recordId}:${index}`
          graph.push({
            '@id': activityId,
            '@type': 'prov:Activity',
            'rdfs:label': lineage.transformationName,
            'prov:startedAtTime': lineage.timestamp.toISOString(),
            'prov:endedAtTime': lineage.timestamp.toISOString(),
          })

          // Link activity to record
          if (lineage.operationType === 'CREATE' || lineage.operationType === 'UPDATE') {
            graph.push({
              '@id': `record:${record.recordId}`,
              'prov:wasGeneratedBy': {
                '@id': activityId,
              },
            })
          }
        })

        return graph
      }),
      signatures: data.signatures.map((sig) => ({
        recordId: sig.recordId,
        hash: sig.hash,
        timestamp: sig.timestamp.toISOString(),
        algorithm: 'SHA-256',
      })),
      metadata: {
        ...data.metadata,
        exportDate: data.metadata.exportDate.toISOString(),
      },
    }

    return JSON.stringify(jsonLd, null, 2)
  }

  /**
   * Export as PDF format
   * Note: This is a simplified implementation. In production, use a proper PDF library like pdfkit or puppeteer
   */
  private async exportAsPDF(data: ProvenanceData): Promise<string> {
    // For now, return a simple text representation
    // In production, use a PDF library to generate proper PDF
    const lines: string[] = []

    lines.push('PROVENANCE EXPORT REPORT')
    lines.push('='.repeat(50))
    lines.push('')
    lines.push(`Export Date: ${data.metadata.exportDate.toLocaleString()}`)
    lines.push(`Format Version: ${data.metadata.version}`)
    lines.push('')

    data.records.forEach((record) => {
      lines.push(`Record ID: ${record.recordId}`)
      lines.push(`Source System: ${record.sourceSystem}`)
      lines.push('')
      lines.push('Lineage:')
      record.lineage.forEach((lineage, index) => {
        lines.push(`  ${index + 1}. ${lineage.transformationName}`)
        lines.push(`     Operation: ${lineage.operationType}`)
        lines.push(`     Timestamp: ${lineage.timestamp.toISOString()}`)
        if (lineage.metadata) {
          lines.push(`     Metadata: ${JSON.stringify(lineage.metadata)}`)
        }
        lines.push('')
      })
      lines.push('-'.repeat(50))
      lines.push('')
    })

    if (data.signatures.length > 0) {
      lines.push('AUDIT SIGNATURES')
      lines.push('='.repeat(50))
      lines.push('')
      data.signatures.forEach((sig) => {
        lines.push(`Record ID: ${sig.recordId}`)
        lines.push(`Hash: ${sig.hash}`)
        lines.push(`Timestamp: ${sig.timestamp.toISOString()}`)
        lines.push('')
      })
    }

    // In production, convert this to actual PDF using a library
    // For now, return as text
    return lines.join('\n')
  }

  /**
   * Verify signature of exported provenance data
   */
  async verifySignature(
    recordId: string,
    hash: string,
    exportedData: string
  ): Promise<boolean> {
    // Recompute hash from exported data
    const computedHash = crypto.createHash('sha256').update(exportedData).digest('hex')

    // Compare with provided hash
    return computedHash === hash
  }
}

