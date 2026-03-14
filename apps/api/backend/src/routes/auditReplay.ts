/**
 * auditReplay.ts — Decision Accountability API
 *
 * GET  /api/decisions/:id/evidence        — full evidence reconstruction for a capsule
 * GET  /api/decisions/:id/chain           — authority chain visualization
 * GET  /api/decisions/:id/bundle          — deep audit bundle (JSON, self-verifying)
 * GET  /api/decisions/npi/:npi/timeline   — clinician decision timeline with replay links
 * POST /api/decisions/:id/attest          — add verifier attestation to a capsule
 *
 * Note: The basic replay hash-check endpoint already lives in decisionCapsules.ts:
 *   GET /api/decisions/:capsuleId/replay  — lightweight hash match (existing)
 * These routes add deeper accountability on top.
 */

import type { Express, Request, Response } from 'express';
import {
  replayDecision,
  buildAuditBundle,
  addAttestation,
} from '../services/audit/replayEngine';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NPI_RE  = /^\d{10}$/;

export function registerAuditReplayRoutes(app: Express): void {

  /**
   * GET /api/decisions/:id/evidence
   *
   * Full evidence reconstruction — the complete picture of what was known
   * at the moment this decision was made.
   *
   * Returns:
   *   - All VerificationArtifacts that supported the decision
   *   - Each source consulted (label, outcome, confidence)
   *   - Trust state snapshot at decision time
   *   - Anomalies detected
   *   - Integrity hash check
   */
  app.get('/api/decisions/:id/evidence', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    try {
      const replay = await replayDecision(id);
      res.json({
        capsuleId:         replay.capsuleId,
        subjectNpi:        replay.subjectNpi,
        decisionType:      replay.decisionType,
        decisionTimestamp: replay.decisionTimestamp,
        integrity:         replay.integrity,
        evidenceSnapshot:  replay.evidenceSnapshot,
        verifierIdentity:  replay.verifierIdentity,
        replayedAt:        replay.replayedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'auditReplay: /evidence failed', { id, error: msg });
      res.status(500).json({ error: 'Evidence reconstruction failed' });
    }
  });

  /**
   * GET /api/decisions/:id/chain
   *
   * Authority chain — proves credential → issuer → verifier → decision.
   * Answers: "How did this clinician earn the right to this decision?"
   *
   * Response includes:
   *   - Ordered chain links (CLINICIAN → CREDENTIAL → ISSUER → VERIFIER → DECISION)
   *   - Each link: nodeType, label, source, status, linkedAt, edgeType
   *   - Integrity check for chain completeness
   */
  app.get('/api/decisions/:id/chain', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    try {
      const replay = await replayDecision(id);
      const chain  = replay.authorityChain;

      // Summarize chain health
      const nodeTypes = chain.map(l => l.nodeType);
      const hasAllNodes = ['CLINICIAN', 'CREDENTIAL', 'ISSUER', 'VERIFIER', 'DECISION'].every(
        t => nodeTypes.includes(t as typeof chain[number]['nodeType'])
      );
      const brokenLinks = chain.filter(l => l.status === 'REVOKED' || l.status === 'INVALID' || l.status === 'EXPIRED');

      res.json({
        capsuleId:    id,
        subjectNpi:   replay.subjectNpi,
        subjectDid:   replay.subjectDid,
        chainLength:  chain.length,
        chainHealth:  brokenLinks.length === 0 ? (hasAllNodes ? 'COMPLETE' : 'PARTIAL') : 'BROKEN',
        brokenLinks:  brokenLinks.map(l => ({ position: l.position, label: l.label, status: l.status })),
        chain,
        integrityHash: replay.integrity.storedHash,
        hashValid:     replay.integrity.hashMatch,
        generatedAt:   replay.replayedAt,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'auditReplay: /chain failed', { id, error: msg });
      res.status(500).json({ error: 'Authority chain construction failed' });
    }
  });

  /**
   * GET /api/decisions/:id/bundle
   *
   * Deep audit bundle — a self-describing, self-verifying document containing
   * the full replay, all evidence, authority chain, and verification instructions.
   * Ready for Joint Commission review, CMS audits, or litigation discovery.
   *
   * Query: ?format=json (default) | ndjson
   *        ?include=replay,evidence,chain (default: all)
   */
  app.get('/api/decisions/:id/bundle', async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    const fmt = req.query.format === 'ndjson' ? 'ndjson' : 'json';

    try {
      const replay = await replayDecision(id);
      const exportedAt = new Date().toISOString();

      // Bundle hash: SHA-256 of the replay content
      const { createHash } = await import('crypto');
      const bundleHash = createHash('sha256')
        .update(JSON.stringify({ capsuleId: id, exportedAt, replay }), 'utf8')
        .digest('hex');

      const bundle = {
        schema:        'https://vitalcv.com/audit-bundle/v1',
        bundleVersion: '1.0',
        bundleId:      crypto.randomUUID(),
        bundleHash,
        exportedAt,
        subject: { npi: replay.subjectNpi, did: replay.subjectDid },
        capsuleCount: 1,
        issuer: 'VitalCV',
        methodology: replay.integrity.methodology,
        replay,
        verificationInstructions: {
          hashAlgorithm: 'SHA-256',
          how: 'Verify replay.integrity.hashMatch === true. Bundle hash = SHA-256(JSON.stringify({ capsuleId, exportedAt, replay })).',
          replayEndpoint: `GET https://api.vitalcv.com/api/decisions/${id}/replay`,
          verifyEndpoint: `GET https://api.vitalcv.com/api/decisions/${id}/verify`,
        },
        custodyLog: [
          { event: 'BUNDLE_EXPORTED', timestamp: exportedAt, actor: 'VitalCV/auditReplay@v1' },
          { event: 'HASH_COMPUTED',   timestamp: exportedAt, actor: 'VitalCV/auditReplay@v1' },
        ],
      };

      const filename = `vitalcv-audit-${id.slice(0, 8)}-${exportedAt.split('T')[0]!}`;

      if (fmt === 'ndjson') {
        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.ndjson"`);
        const lines = [
          JSON.stringify({ _type: 'bundle_header', bundleId: bundle.bundleId, bundleHash, exportedAt, capsuleId: id }),
          JSON.stringify({ _type: 'decision_replay', ...replay }),
          ...replay.evidenceSnapshot.evidenceRecords.map(e => JSON.stringify({ _type: 'evidence_record', ...e })),
          ...replay.authorityChain.map(l => JSON.stringify({ _type: 'chain_link', ...l })),
          JSON.stringify({ _type: 'verification', ...bundle.verificationInstructions }),
        ];
        res.send(lines.join('\n'));
        return;
      }

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
      res.json(bundle);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'auditReplay: /bundle failed', { id, error: msg });
      res.status(500).json({ error: 'Audit bundle export failed' });
    }
  });

  /**
   * GET /api/decisions/npi/:npi/timeline
   *
   * Complete decision history for a clinician — every recorded decision
   * across all types (HIRING / PRIVILEGING / DEPLOYMENT / RENEWAL).
   * Each entry includes a replay link and integrity status.
   *
   * Query: ?type=HIRING|PRIVILEGING|DEPLOYMENT|RENEWAL
   *        ?status=VALID|AT_RISK|INVALID
   *        ?limit=50
   */
  app.get('/api/decisions/npi/:npi/timeline', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) { res.status(400).json({ error: 'Valid 10-digit NPI required' }); return; }

    const typeFilter   = typeof req.query.type === 'string' ? req.query.type.toUpperCase() : null;
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;
    const limit        = Math.min(Number(req.query.limit ?? 50), 200);

    try {
      const capsules = await prisma.decisionCapsule.findMany({
        where: {
          subjectNpi: npi,
          ...(typeFilter   ? { decisionType: typeFilter } : {}),
          ...(statusFilter ? { status:       statusFilter } : {}),
        },
        select: {
          id: true, decisionType: true, decisionTimestamp: true,
          status: true, artifactHash: true, methodology: true,
          metadata: true,
        },
        orderBy: { decisionTimestamp: 'desc' },
        take: limit,
      });

      const events = capsules.map(c => {
        const meta = (c.metadata ?? {}) as Record<string, unknown>;
        return {
          capsuleId:         c.id,
          decisionType:      c.decisionType,
          decisionTimestamp: c.decisionTimestamp.toISOString(),
          status:            c.status,
          action:            typeof meta.decisionAction === 'string' ? meta.decisionAction : null,
          organization:      typeof meta.facilityName === 'string' ? meta.facilityName
            : typeof meta.organizationName === 'string' ? meta.organizationName : null,
          artifactHash:      c.artifactHash,
          methodology:       c.methodology,
          attestations:      Array.isArray(meta.attestations) ? (meta.attestations as unknown[]).length : 0,
          links: {
            replay:   `/api/decisions/${c.id}/replay`,
            evidence: `/api/decisions/${c.id}/evidence`,
            chain:    `/api/decisions/${c.id}/chain`,
            bundle:   `/api/decisions/${c.id}/bundle`,
          },
        };
      });

      // Summary stats
      const valid    = events.filter(e => e.status === 'VALID').length;
      const atRisk   = events.filter(e => e.status === 'AT_RISK').length;
      const invalid  = events.filter(e => e.status === 'INVALID').length;
      const types    = [...new Set(events.map(e => e.decisionType))];

      res.json({
        npi,
        totalDecisions: events.length,
        summary: { valid, atRisk, invalid, types },
        filters: { type: typeFilter, status: statusFilter },
        events,
        passportUrl:     `https://vitalcv.com/p/${npi}`,
        bundleExportUrl: `/api/decisions/export/${npi}`,
        generatedAt:     new Date().toISOString(),
      });
    } catch (err) {
      log('error', 'auditReplay: /timeline failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Timeline fetch failed' });
    }
  });

  /**
   * POST /api/decisions/:id/attest
   *
   * Add a verifier attestation to an existing decision capsule.
   * Attestations are append-only (immutable once added).
   *
   * Body: {
   *   attesterId:   string    (org ID, user ID, or system identifier)
   *   attesterRole: string    e.g. "Chief Medical Officer", "Credentialing Committee"
   *   statement:    string    e.g. "Reviewed and confirmed clinician meets all facility standards"
   *   timestamp?:   string    ISO — defaults to now
   * }
   *
   * Returns: { capsuleId, attestationCount, attestedAt }
   */
  app.post('/api/decisions/:id/attest', async (req: Request, res: Response) => {
    const { id }  = req.params;
    if (!UUID_RE.test(id)) { res.status(400).json({ error: 'Invalid capsule ID' }); return; }

    const body = req.body as Record<string, unknown>;
    const attesterId   = typeof body.attesterId   === 'string' ? body.attesterId.trim()   : '';
    const attesterRole = typeof body.attesterRole === 'string' ? body.attesterRole.trim() : '';
    const statement    = typeof body.statement    === 'string' ? body.statement.trim()    : '';

    if (!attesterId)   { res.status(400).json({ error: 'attesterId required' });   return; }
    if (!attesterRole) { res.status(400).json({ error: 'attesterRole required' }); return; }
    if (!statement)    { res.status(400).json({ error: 'statement required' });    return; }
    if (statement.length > 2000) { res.status(400).json({ error: 'statement must be ≤ 2000 chars' }); return; }

    try {
      const result = await addAttestation(id, {
        attesterId, attesterRole, statement,
        timestamp: typeof body.timestamp === 'string' ? body.timestamp : undefined,
      });

      log('info', 'auditReplay: attestation added', {
        capsuleId: id, attesterId, role: attesterRole,
      });

      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not found')) { res.status(404).json({ error: msg }); return; }
      log('error', 'auditReplay: /attest failed', { id, error: msg });
      res.status(500).json({ error: 'Attestation failed' });
    }
  });
}
