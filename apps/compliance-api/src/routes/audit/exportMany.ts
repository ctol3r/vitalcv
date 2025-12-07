/**
 * NCQA Audit Export: Multi-Provider Evidence Bundle
 * B133A-AUD-008: Accepts providerIds[], creates zipped folder with one evidence ZIP per ID
 *
 * This route:
 * 1. Accepts array of provider IDs
 * 2. Generates evidence bundle ZIP for each provider
 * 3. Creates a master ZIP containing all provider ZIPs
 * 4. Logs export event for audit trail
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import archiver from 'archiver';
import { Readable } from 'stream';

const router = Router();
const prisma = new PrismaClient();

/**
 * Provider evidence bundle metadata
 */
interface ProviderEvidenceBundle {
  providerId: string;
  npi?: string;
  name?: string;
  credentialCount: number;
  evidenceFiles: string[];
  generatedAt: string;
}

/**
 * Multi-provider export result
 */
interface MultiProviderExportResult {
  success: boolean;
  exportId: string;
  providerCount: number;
  providers: ProviderEvidenceBundle[];
  totalCredentials: number;
  timestamp: string;
  downloadUrl?: string;
  error?: string;
}

/**
 * Generate evidence bundle for a single provider
 * Returns a Buffer containing the ZIP file
 */
async function generateProviderEvidenceZip(
  providerId: string
): Promise<{
  buffer: Buffer;
  metadata: ProviderEvidenceBundle;
}> {
  // Fetch provider data
  const provider = await prisma.user.findUnique({
    where: { id: providerId },
    include: {
      credentials: {
        where: {
          status: 'active',
        },
      },
      npiClaims: true,
    },
  });

  if (!provider) {
    throw new Error(`Provider ${providerId} not found`);
  }

  // Create ZIP archive in memory
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Maximum compression
  });

  const chunks: Buffer[] = [];

  // Collect chunks
  archive.on('data', (chunk: Buffer) => {
    chunks.push(chunk);
  });

  // Add provider metadata
  const providerMetadata = {
    providerId: provider.id,
    name: provider.name,
    email: provider.email,
    npi: provider.npiClaims[0]?.npi || 'N/A',
    did: provider.did || 'N/A',
    exportedAt: new Date().toISOString(),
  };

  archive.append(JSON.stringify(providerMetadata, null, 2), {
    name: 'provider-metadata.json',
  });

  // Add credentials
  const evidenceFiles: string[] = ['provider-metadata.json'];

  provider.credentials.forEach((credential, index) => {
    const credentialData = {
      id: credential.id,
      name: credential.name,
      issuer: credential.issuer,
      issuerDid: credential.issuerDid,
      holderDid: credential.holderDid,
      credHash: credential.credHash,
      type: credential.type,
      status: credential.status,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
    };

    const filename = `credential-${index + 1}-${credential.type.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
    archive.append(JSON.stringify(credentialData, null, 2), {
      name: `credentials/${filename}`,
    });
    evidenceFiles.push(`credentials/${filename}`);
  });

  // Add NPI claims
  if (provider.npiClaims.length > 0) {
    provider.npiClaims.forEach((claim, index) => {
      const claimData = {
        id: claim.id,
        npi: claim.npi,
        level: claim.level,
        evidence: claim.evidence,
        issuerAttestationTx: claim.issuerAttestationTx,
        lastVerifiedAt: claim.lastVerifiedAt,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
      };

      const filename = `npi-claim-${index + 1}.json`;
      archive.append(JSON.stringify(claimData, null, 2), {
        name: `npi-claims/${filename}`,
      });
      evidenceFiles.push(`npi-claims/${filename}`);
    });
  }

  // Finalize archive
  await archive.finalize();

  // Wait for all chunks
  await new Promise((resolve) => {
    archive.on('end', resolve);
  });

  const buffer = Buffer.concat(chunks);

  const metadata: ProviderEvidenceBundle = {
    providerId: provider.id,
    npi: provider.npiClaims[0]?.npi,
    name: provider.name,
    credentialCount: provider.credentials.length,
    evidenceFiles,
    generatedAt: new Date().toISOString(),
  };

  return { buffer, metadata };
}

/**
 * Log audit export event
 */
async function logAuditExportEvent(
  exportId: string,
  providerIds: string[],
  requestedBy: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        type: 'NCQA_MULTI_PROVIDER_EXPORT',
        data: {
          exportId,
          providerIds,
          providerCount: providerIds.length,
          requestedBy,
          success,
          error,
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (logError) {
    console.error('[Audit Export] Failed to log audit event:', logError);
  }
}

/**
 * POST /audit/export-many
 *
 * Export evidence bundles for multiple providers
 *
 * Body:
 * {
 *   "providerIds": ["id1", "id2", "id3"],
 *   "requestedBy": "admin-user-id"
 * }
 */
router.post('/export-many', async (req: Request, res: Response) => {
  const { providerIds, requestedBy } = req.body;

  // Validation
  if (!Array.isArray(providerIds) || providerIds.length === 0) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'providerIds must be a non-empty array',
    });
  }

  if (providerIds.length > 100) {
    return res.status(400).json({
      error: 'Too many providers',
      message: 'Maximum 100 providers per export',
    });
  }

  const exportId = `export-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    console.log(`📦 [Audit Export] Starting multi-provider export: ${exportId}`);
    console.log(`📋 [Audit Export] Providers: ${providerIds.length}`);

    // Generate individual provider ZIPs
    const providerBundles: {
      buffer: Buffer;
      metadata: ProviderEvidenceBundle;
    }[] = [];

    for (const providerId of providerIds) {
      try {
        console.log(`  📄 Processing provider: ${providerId}`);
        const bundle = await generateProviderEvidenceZip(providerId);
        providerBundles.push(bundle);
      } catch (error: any) {
        console.error(`  ❌ Failed to generate bundle for ${providerId}:`, error.message);
        // Continue with other providers
      }
    }

    if (providerBundles.length === 0) {
      await logAuditExportEvent(exportId, providerIds, requestedBy || 'unknown', false, 'No valid providers found');
      return res.status(404).json({
        error: 'No evidence bundles generated',
        message: 'None of the provided provider IDs were valid',
      });
    }

    // Create master ZIP containing all provider ZIPs
    const masterArchive = archiver('zip', {
      zlib: { level: 9 },
    });

    // Set response headers for download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=ncqa-audit-export-${exportId}.zip`);

    // Pipe master archive to response
    masterArchive.pipe(res);

    // Add each provider's ZIP to master archive
    providerBundles.forEach((bundle, index) => {
      const providerNpi = bundle.metadata.npi || 'no-npi';
      const providerName = bundle.metadata.name.replace(/[^a-zA-Z0-9]/g, '_');
      const zipFilename = `provider-${index + 1}-${providerNpi}-${providerName}.zip`;

      masterArchive.append(bundle.buffer, { name: zipFilename });
    });

    // Add export manifest
    const manifest: MultiProviderExportResult = {
      success: true,
      exportId,
      providerCount: providerBundles.length,
      providers: providerBundles.map(b => b.metadata),
      totalCredentials: providerBundles.reduce((sum, b) => sum + b.metadata.credentialCount, 0),
      timestamp: new Date().toISOString(),
    };

    masterArchive.append(JSON.stringify(manifest, null, 2), {
      name: 'export-manifest.json',
    });

    // Finalize master archive
    await masterArchive.finalize();

    // Log successful export
    await logAuditExportEvent(exportId, providerIds, requestedBy || 'unknown', true);

    console.log(`✅ [Audit Export] Completed: ${exportId}`);

  } catch (error: any) {
    console.error(`❌ [Audit Export] Failed: ${error.message}`);

    // Log failed export
    await logAuditExportEvent(exportId, providerIds, requestedBy || 'unknown', false, error.message);

    return res.status(500).json({
      error: 'Export failed',
      message: error.message,
      exportId,
    });
  }
});

/**
 * GET /audit/export-history
 *
 * Returns history of multi-provider exports
 */
router.get('/export-history', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;

    const history = await prisma.auditEvent.findMany({
      where: {
        type: 'NCQA_MULTI_PROVIDER_EXPORT',
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return res.status(200).json({
      count: history.length,
      exports: history.map(event => ({
        id: event.id,
        exportId: (event.data as any).exportId,
        providerCount: (event.data as any).providerCount,
        requestedBy: (event.data as any).requestedBy,
        success: (event.data as any).success,
        timestamp: event.createdAt,
        error: (event.data as any).error,
      })),
    });
  } catch (error: any) {
    console.error('[Audit Export History] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch export history',
      message: error.message,
    });
  }
});

/**
 * POST /audit/export-single
 *
 * Export evidence bundle for a single provider (convenience endpoint)
 */
router.post('/export-single', async (req: Request, res: Response) => {
  const { providerId, requestedBy } = req.body;

  if (!providerId) {
    return res.status(400).json({
      error: 'Invalid request',
      message: 'providerId is required',
    });
  }

  // Redirect to export-many with single provider
  return router.handle(
    { ...req, body: { providerIds: [providerId], requestedBy } },
    res,
    () => {}
  );
});

export default router;

