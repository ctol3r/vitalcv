/**
 * B237B-DP-011: DataExportService
 *
 * Exports selected records or entire vault as encrypted ZIP, JSON or PDF.
 * Supports multiple formats, tracks export events, includes user confirmation flow.
 */

import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { PassThrough } from 'node:stream';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

export type ExportFormat = 'ZIP' | 'JSON' | 'PDF';

export interface ExportOptions {
  format: ExportFormat;
  recordIds?: string[]; // If empty, exports entire vault
  password?: string; // For encrypted ZIP
  includeMetadata?: boolean;
}

export interface ExportResult {
  exportId: string;
  fileLocation: string;
  fileSize: number;
  checksum: string;
  format: ExportFormat;
  recordCount: number;
}

export class DataExportService {
  constructor(
    private prisma: PrismaClient,
    private storagePath: string = process.env.EXPORT_STORAGE_PATH || join(tmpdir(), 'vault-exports')
  ) {}

  /**
   * Request an export - creates a pending export event
   * User must confirm before export is generated
   */
  async requestExport(
    vaultId: string,
    userId: string,
    options: ExportOptions
  ): Promise<{ exportId: string; requiresConfirmation: boolean }> {
    // Verify vault ownership
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
      include: { records: true },
    });

    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }

    if (vault.ownerId !== userId) {
      throw new Error('Unauthorized: You do not own this vault');
    }

    // Determine which records to export
    const recordIds = options.recordIds && options.recordIds.length > 0
      ? options.recordIds
      : vault.records.map(r => r.id);

    // Create export event
    const exportEvent = await this.prisma.dataExportEvent.create({
      data: {
        vaultId,
        userId,
        format: options.format,
        recordIds,
        status: 'pending',
        metadata: {
          includeMetadata: options.includeMetadata ?? true,
          requestedAt: new Date().toISOString(),
        },
      },
    });

    return {
      exportId: exportEvent.id,
      requiresConfirmation: true, // Always require confirmation for security
    };
  }

  /**
   * Confirm and execute export after user confirmation
   */
  async confirmAndExport(
    exportId: string,
    userId: string,
    password?: string
  ): Promise<ExportResult> {
    const exportEvent = await this.prisma.dataExportEvent.findUnique({
      where: { id: exportId },
      include: {
        vault: {
          include: {
            records: true,
            owner: true,
          },
        },
      },
    });

    if (!exportEvent) {
      throw new Error(`Export event not found: ${exportId}`);
    }

    if (exportEvent.userId !== userId) {
      throw new Error('Unauthorized: You did not request this export');
    }

    if (exportEvent.status !== 'pending') {
      throw new Error(`Export already ${exportEvent.status}`);
    }

    // Mark as confirmed
    await this.prisma.dataExportEvent.update({
      where: { id: exportId },
      data: {
        confirmedAt: new Date(),
        status: 'processing',
      },
    });

    try {
      // Filter records based on recordIds
      const recordsToExport = exportEvent.recordIds.length > 0
        ? exportEvent.vault.records.filter(r => exportEvent.recordIds.includes(r.id))
        : exportEvent.vault.records;

      // Generate export based on format
      let result: ExportResult;
      switch (exportEvent.format) {
        case 'ZIP':
          result = await this.exportAsZip(exportEvent.vault, recordsToExport, password);
          break;
        case 'JSON':
          result = await this.exportAsJson(exportEvent.vault, recordsToExport);
          break;
        case 'PDF':
          result = await this.exportAsPdf(exportEvent.vault, recordsToExport);
          break;
        default:
          throw new Error(`Unsupported format: ${exportEvent.format}`);
      }

      // Update export event with results
      await this.prisma.dataExportEvent.update({
        where: { id: exportId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          fileLocation: result.fileLocation,
          fileSize: BigInt(result.fileSize),
          checksum: result.checksum,
        },
      });

      // Log export in audit trail
      await this.prisma.vaultAuditLog.create({
        data: {
          vaultId: exportEvent.vaultId,
          actorId: userId,
          action: 'export',
          scope: `format:${exportEvent.format}`,
          metadata: {
            exportId,
            recordCount: result.recordCount,
            format: exportEvent.format,
          },
          hash: this.generateAuditHash(exportEvent.vaultId, userId, 'export', exportId),
        },
      });

      return result;
    } catch (error: any) {
      // Mark as failed
      await this.prisma.dataExportEvent.update({
        where: { id: exportId },
        data: {
          status: 'failed',
          error: error.message || 'Unknown error',
        },
      });
      throw error;
    }
  }

  /**
   * Export vault data as encrypted ZIP
   */
  private async exportAsZip(
    vault: any,
    records: any[],
    password?: string
  ): Promise<ExportResult> {
    await mkdir(this.storagePath, { recursive: true });

    const filename = `vault-${vault.id}-${Date.now()}.zip`;
    const filePath = join(this.storagePath, filename);

    const archive = archiver('zip', {
      zlib: { level: 9 },
      ...(password ? { password } : {}),
    });

    const stream = new PassThrough();
    const chunks: Buffer[] = [];

    stream.on('data', (chunk) => chunks.push(chunk));

    archive.pipe(stream);

    // Add manifest
    const manifest = {
      vaultId: vault.id,
      ownerId: vault.ownerId,
      exportedAt: new Date().toISOString(),
      recordCount: records.length,
      format: 'ZIP',
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // Add records as JSON
    const recordsData = records.map(record => ({
      id: record.id,
      type: record.type,
      metadata: record.metadata,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      // Note: encryptedPayload is not included for security - would need decryption key
      // In production, you'd decrypt here if user has access
    }));
    archive.append(JSON.stringify(recordsData, null, 2), { name: 'records.json' });

    await archive.finalize();

    await new Promise<void>((resolve, reject) => {
      stream.on('end', () => resolve());
      stream.on('error', reject);
      archive.on('error', reject);
    });

    const buffer = Buffer.concat(chunks);
    await writeFile(filePath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      exportId: '', // Will be set by caller
      fileLocation: filePath,
      fileSize: buffer.length,
      checksum,
      format: 'ZIP',
      recordCount: records.length,
    };
  }

  /**
   * Export vault data as JSON
   */
  private async exportAsJson(
    vault: any,
    records: any[]
  ): Promise<ExportResult> {
    await mkdir(this.storagePath, { recursive: true });

    const filename = `vault-${vault.id}-${Date.now()}.json`;
    const filePath = join(this.storagePath, filename);

    const exportData = {
      vault: {
        id: vault.id,
        ownerId: vault.ownerId,
        createdAt: vault.createdAt,
        updatedAt: vault.updatedAt,
      },
      records: records.map(record => ({
        id: record.id,
        type: record.type,
        metadata: record.metadata,
        version: record.version,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    const jsonData = JSON.stringify(exportData, null, 2);
    const buffer = Buffer.from(jsonData, 'utf-8');
    await writeFile(filePath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      exportId: '',
      fileLocation: filePath,
      fileSize: buffer.length,
      checksum,
      format: 'JSON',
      recordCount: records.length,
    };
  }

  /**
   * Export vault data as PDF
   */
  private async exportAsPdf(
    vault: any,
    records: any[]
  ): Promise<ExportResult> {
    await mkdir(this.storagePath, { recursive: true });

    const filename = `vault-${vault.id}-${Date.now()}.pdf`;
    const filePath = join(this.storagePath, filename);

    // Generate HTML for PDF
    const html = this.generatePdfHtml(vault, records);

    // Render PDF using playwright or remote service
    const buffer = await this.renderPdf(html);

    await writeFile(filePath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    return {
      exportId: '',
      fileLocation: filePath,
      fileSize: buffer.length,
      checksum,
      format: 'PDF',
      recordCount: records.length,
    };
  }

  /**
   * Generate HTML for PDF export
   */
  private generatePdfHtml(vault: any, records: any[]): string {
    const recordsHtml = records.map(record => `
      <div style="margin-bottom: 20px; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #0f172a;">${this.escapeHtml(String(record.type))}</h3>
        <p style="margin: 5px 0; color: #64748b; font-size: 12px;">ID: ${this.escapeHtml(record.id)}</p>
        <p style="margin: 5px 0; color: #64748b; font-size: 12px;">Version: ${record.version}</p>
        ${record.metadata ? `<pre style="margin: 10px 0; padding: 10px; background: #f8fafc; border-radius: 4px; font-size: 11px; overflow-x: auto;">${this.escapeHtml(JSON.stringify(record.metadata, null, 2))}</pre>` : ''}
        <p style="margin: 5px 0; color: #64748b; font-size: 11px;">Created: ${new Date(record.createdAt).toLocaleString()}</p>
      </div>
    `).join('');

    return `
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <title>Vault Export - ${this.escapeHtml(vault.id)}</title>
          <style>
            body {
              font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 40px;
              color: #0f172a;
              background: #fff;
            }
            h1 {
              font-size: 24px;
              margin: 0 0 10px 0;
            }
            .subtitle {
              color: #64748b;
              font-size: 14px;
              margin: 0 0 30px 0;
            }
          </style>
        </head>
        <body>
          <h1>Personal Data Vault Export</h1>
          <p class="subtitle">Vault ID: ${this.escapeHtml(vault.id)} | Exported: ${new Date().toLocaleString()}</p>
          <p class="subtitle">Total Records: ${records.length}</p>
          ${recordsHtml}
        </body>
      </html>
    `;
  }

  /**
   * Render PDF from HTML
   */
  private async renderPdf(html: string): Promise<Buffer> {
    const rendererUrl = process.env.PDF_RENDERER_URL;

    if (rendererUrl) {
      const response = await fetch(rendererUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html }),
      });

      if (!response.ok) {
        throw new Error(`PDF renderer failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Fallback to playwright-core if available
    try {
      const playwright: any = await import('playwright-core');
      const browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });

      try {
        const page = await browser.newPage({ deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle' });
        const pdfBuffer: Buffer = await page.pdf({
          format: 'Letter',
          margin: { top: '0.6in', bottom: '0.6in', left: '0.5in', right: '0.5in' },
          printBackground: true,
        });
        await page.close();
        return pdfBuffer;
      } finally {
        await browser.close();
      }
    } catch (error) {
      throw new Error('Unable to render PDF. Provide PDF_RENDERER_URL or install playwright-core.');
    }
  }

  /**
   * Generate audit hash for tamper detection
   */
  private generateAuditHash(
    vaultId: string,
    actorId: string,
    action: string,
    recordId?: string
  ): string {
    const data = `${vaultId}:${actorId}:${action}:${recordId || ''}:${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string, userId: string) {
    const exportEvent = await this.prisma.dataExportEvent.findUnique({
      where: { id: exportId },
    });

    if (!exportEvent) {
      throw new Error(`Export event not found: ${exportId}`);
    }

    if (exportEvent.userId !== userId) {
      throw new Error('Unauthorized');
    }

    return exportEvent;
  }

  /**
   * List exports for a vault
   */
  async listExports(vaultId: string, userId: string) {
    const vault = await this.prisma.personalDataVault.findUnique({
      where: { id: vaultId },
    });

    if (!vault || vault.ownerId !== userId) {
      throw new Error('Unauthorized');
    }

    return this.prisma.dataExportEvent.findMany({
      where: { vaultId, userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

