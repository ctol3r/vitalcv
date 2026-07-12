import crypto from 'crypto';
import type { Express, Request, Response } from 'express';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { getVerificationSource, SourceAccessRequiredError } from '../../services/sourceRegistry';
import { sha256Hex } from '../../utils/deterministic';
import { buildVerificationMerklePayload } from '../../services/artifactService';

function parseNpi(input: unknown): string {
  const trimmed = typeof input === 'string' ? input.trim() : '';
  if (!/^\d{10}$/.test(trimmed)) {
    throw new Error('npi must be a 10-digit string');
  }
  return trimmed;
}

export function registerWave2AVerifyRoutes(app: Express): void {
  /**
   * POST /api/v2/verify
   *
   * Wave 2A persistence: upserts Provider, creates VerificationRun + Artifact.
   * Body: { npi: string }
   */
  app.post('/api/v2/verify', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const npi = parseNpi(body.npi);

      // 1. Run verification through the source adapter
      const source = getVerificationSource('NURSYS');
      const result = await source.verify(npi);
      const rawPayload = result.rawPayload;
      const rawPayloadHash = sha256Hex(JSON.stringify(rawPayload));

      // 2. Build Merkle payload for the artifact hash
      const { fingerprint, merkleRoot, claimHashes } = buildVerificationMerklePayload(npi, result);

      // 3. Build the artifact JSON
      const artifactJson = {
        npi,
        source: source.name,
        licenseStatus: result.licenseStatus,
        jurisdiction: result.jurisdiction,
        lastUpdated: result.lastUpdated.toISOString(),
        expirationDate: result.expirationDate?.toISOString() ?? null,
        fingerprint,
        merkleRoot,
        claimHashes,
      };

      const artifactHash = sha256Hex(JSON.stringify(artifactJson));
      const now = new Date();

      // 4. Persist in a transaction: upsert Provider → create VerificationRun → create Artifact
      const { provider, run, artifact } = await prisma.$transaction(async (tx) => {
        const prov = await tx.provider.upsert({
          where: { npi },
          create: {
            npi,
            fullName: `Provider ${npi}`,
            providerType: 'UNKNOWN',
            taxonomyCode: '000000X0000X',
            stateOfPractice: result.jurisdiction,
          },
          update: {
            stateOfPractice: result.jurisdiction,
            updatedAt: now,
          },
        });

        const vRun = await tx.verificationRun.create({
          data: {
            providerId: prov.id,
            sourceName: source.name,
            retrievedAtUtc: now,
            rawPayloadHash,
            artifactHash,
          },
        });

        const art = await tx.w2Artifact.create({
          data: {
            verificationRunId: vRun.id,
            artifactJson,
            signature: sha256Hex(`${artifactHash}:${now.toISOString()}`),
            signatureAlgorithm: 'SHA256-HMAC-STUB',
            signatureIssuedAt: now,
          },
        });

        return { provider: prov, run: vRun, artifact: art };
      });

      log('info', 'wave2a_verify_success', {
        event: 'wave2a_verify_success',
        npi,
        providerId: provider.id,
        runId: run.id,
        artifactId: artifact.id,
      });

      return res.status(201).json({
        artifactId: artifact.id,
        providerId: provider.id,
        verificationRunId: run.id,
        npi,
        source: source.name,
        licenseStatus: result.licenseStatus,
        verifiedAt: now.toISOString(),
      });
    } catch (error) {
      if (error instanceof SourceAccessRequiredError) {
        // Fail closed: production must not persist fabricated verifications.
        log('warn', 'wave2a_verify_source_access_required', {
          event: 'wave2a_verify_source_access_required',
          error: error.message,
        });
        return res.status(503).json({ error: 'source_access_required', message: error.message });
      }
      const message = error instanceof Error ? error.message : 'Verification failed';
      log('error', 'wave2a_verify_error', {
        event: 'wave2a_verify_error',
        error: message,
      });
      return res.status(400).json({ error: message });
    }
  });

  /**
   * GET /api/v2/artifact/:artifactId
   *
   * Retrieve a persisted artifact by ID.
   */
  app.get('/api/v2/artifact/:artifactId', async (req: Request, res: Response) => {
    try {
      const artifactId = req.params.artifactId?.trim();
      if (!artifactId) {
        return res.status(400).json({ error: 'artifactId is required' });
      }

      const artifact = await prisma.w2Artifact.findUnique({
        where: { id: artifactId },
        include: {
          verificationRun: {
            include: { provider: true },
          },
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      return res.status(200).json({
        artifactId: artifact.id,
        artifactJson: artifact.artifactJson,
        signature: artifact.signature,
        signatureAlgorithm: artifact.signatureAlgorithm,
        signatureIssuedAt: artifact.signatureIssuedAt.toISOString(),
        verificationRun: {
          id: artifact.verificationRun.id,
          sourceName: artifact.verificationRun.sourceName,
          retrievedAtUtc: artifact.verificationRun.retrievedAtUtc.toISOString(),
          rawPayloadHash: artifact.verificationRun.rawPayloadHash,
          artifactHash: artifact.verificationRun.artifactHash,
        },
        provider: {
          id: artifact.verificationRun.provider.id,
          npi: artifact.verificationRun.provider.npi,
          fullName: artifact.verificationRun.provider.fullName,
          providerType: artifact.verificationRun.provider.providerType,
          stateOfPractice: artifact.verificationRun.provider.stateOfPractice,
        },
        createdAt: artifact.createdAt.toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to retrieve artifact';
      return res.status(400).json({ error: message });
    }
  });
}
