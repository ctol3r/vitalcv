import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import type { Express, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { DomainError } from '../../../../packages/domain/errors';
import { EmployerAcceptance } from '../../../../packages/domain/events/EmployerAcceptance';
import { RecognitionEvent } from '../../../../packages/domain/events/RecognitionEvent';
import { StartAttestation } from '../../../../packages/domain/events/StartAttestation';
import { assertCanAccept } from '../../../../packages/domain/guards/assertCanAccept';
import { assertCanStart } from '../../../../packages/domain/guards/assertCanStart';
import { subjectStatus } from '../../../../packages/domain/projections/subjectStatus';
import {
  getAcceptanceById,
  insertAcceptance,
  listAcceptancesBySubject,
} from '../repositories/acceptances.repo';
import {
  getRecognitionById,
  insertRecognition,
  listRecognitionsBySubject,
} from '../repositories/recognitions.repo';
import {
  listStartsByAcceptanceId,
  insertStart,
  listStartsBySubject,
} from '../repositories/starts.repo';
import {
  getReadinessScore,
  neo4jConfigured,
} from '../src/graph/service';
import prisma from '../src/graphql/prisma_client';
import { apiKeyAuth } from '../src/middleware/publicSafety';
import { validateRequest } from '../src/middleware/validateRequest';
import { log } from '../src/obs/logger';

function respondDomainError(res: Response, error: DomainError) {
  const status =
    error.code === 'START_EXISTS' ||
    error.code === 'MISSING_VERIFICATION' ||
    error.code === 'RECOGNITION_EXPIRED' ||
    error.code === 'RECOGNITION_REVOKED'
      ? 409
      : 400;
  return res.status(status).json({
    error: error.message,
    code: error.code,
    blocker: blockerMessageForReasons(
      typeof error.code === 'string' ? [error.code] : ['TRUST_STATE_UNAVAILABLE'],
    ),
  });
}

type RejectionEventType = 'EMPLOYER_ACCEPTANCE_REJECTED' | 'START_REJECTED';
type FactualBlockerMessage =
  | 'Pending verification'
  | 'Failed verification'
  | 'Employer acceptance required';
type CrsSnapshot = {
  score: number;
  band: 'GREEN' | 'YELLOW' | 'RED';
  factors: Record<string, unknown>;
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
}

function rejectionEventHash(
  eventType: RejectionEventType,
  metadata: Record<string, unknown>,
): string {
  return crypto
    .createHash('sha256')
    .update(stableStringify({ eventType, metadata }))
    .digest('hex');
}

async function emitRejectionAuditEvent(input: {
  type: RejectionEventType;
  credentialId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: input.type,
      hash: rejectionEventHash(input.type, input.metadata),
      clinicianId: String(input.metadata.clinician_id ?? input.credentialId),
      referenceId: input.credentialId,
      metadata: input.metadata as Prisma.InputJsonValue,
      createdAt: new Date(),
    },
  });
}

async function emitRejectionAuditEventSafe(input: {
  type: RejectionEventType;
  credentialId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await emitRejectionAuditEvent(input);
  } catch (error) {
    log('error', 'failed to emit rejection audit event', {
      event: 'rejection_audit_emit_failed',
      credentialId: input.credentialId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function trustStateEventHash(metadata: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(stableStringify(metadata)).digest('hex');
}

async function emitTrustStateAuditEvent(input: {
  clinicianId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      type: 'TRUST_STATE_CHECK',
      hash: trustStateEventHash({
        clinician_id: input.clinicianId,
        ...input.metadata,
      }),
      clinicianId: input.clinicianId,
      metadata: {
        clinician_id: input.clinicianId,
        ...input.metadata,
      } as Prisma.InputJsonValue,
      createdAt: new Date(),
    },
  });
}

async function emitTrustStateAuditEventSafe(input: {
  clinicianId: string;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await emitTrustStateAuditEvent(input);
  } catch (error) {
    log('error', 'failed to emit trust-state audit event', {
      event: 'trust_state_audit_emit_failed',
      clinicianId: input.clinicianId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseObjectField(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new DomainError(`${field} is required`, 'MISSING_FIELD');
  }
  return value as Record<string, unknown>;
}

function resolveCrsBand(score: number): 'GREEN' | 'YELLOW' | 'RED' {
  if (score >= 80) return 'GREEN';
  if (score >= 50) return 'YELLOW';
  return 'RED';
}

async function resolveCrsSnapshot(clinicianId: string): Promise<CrsSnapshot> {
  if (!neo4jConfigured()) {
    return {
      score: 95,
      band: 'GREEN',
      factors: {},
    };
  }

  try {
    const readiness = await getReadinessScore(clinicianId);
    return {
      score: readiness.score,
      band: resolveCrsBand(readiness.score),
      factors: readiness.factors as Record<string, unknown>,
    };
  } catch {
    return {
      score: 0,
      band: 'RED',
      factors: {
        trust_state_unavailable: true,
      },
    };
  }
}

function blockerMessageForReasons(reasons: readonly string[]): FactualBlockerMessage {
  if (reasons.includes('MISSING_ACCEPTANCE')) {
    return 'Employer acceptance required';
  }

  if (
    reasons.some((reason) =>
      [
        'FAILED_VERIFICATION',
        'REVOKED_PSV',
        'ACTIVE_SANCTIONS',
        'TRUST_STATE_UNAVAILABLE',
        'IDENTITY_CONFLICT',
      ].includes(reason),
    )
  ) {
    return 'Failed verification';
  }

  return 'Pending verification';
}

function blockerMessagesForReasons(reasons: readonly string[]): readonly FactualBlockerMessage[] {
  const messages = new Set<FactualBlockerMessage>();
  for (const reason of reasons) {
    if (reason === 'MISSING_ACCEPTANCE') {
      messages.add('Employer acceptance required');
      continue;
    }

    if (
      ['FAILED_VERIFICATION', 'REVOKED_PSV', 'ACTIVE_SANCTIONS', 'TRUST_STATE_UNAVAILABLE', 'IDENTITY_CONFLICT'].includes(
        reason,
      )
    ) {
      messages.add('Failed verification');
      continue;
    }

    messages.add('Pending verification');
  }

  return [...messages];
}

export function registerWedgeRoutes(app: Express) {
  app.post(
    '/recognitions',
    apiKeyAuth,
    body('recognition').isObject().withMessage('recognition is required'),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const recognitionInput = parseObjectField(
          (req.body as { recognition?: unknown }).recognition,
          'recognition',
        );

        if ('recognitionId' in recognitionInput) {
          throw new DomainError(
            'recognitionId is generated and must not be provided',
            'ID_PROVIDED',
          );
        }

        if ('revocation' in recognitionInput && recognitionInput.revocation) {
          throw new DomainError(
            'revocation must not be provided on recognition creation',
            'INVALID_FIELD',
          );
        }

        if (!('expiresAt' in recognitionInput)) {
          throw new DomainError('expiresAt is required (use null for no expiry)', 'MISSING_FIELD');
        }

        const verification = parseObjectField(
          recognitionInput.verification,
          'recognition.verification',
        );

        const recognition = new RecognitionEvent({
          subjectId: String(recognitionInput.subjectId ?? ''),
          employerId: String(recognitionInput.employerId ?? ''),
          recognizedAt: String(recognitionInput.recognizedAt ?? ''),
          verification: {
            verifiedAt: String(verification.verifiedAt ?? ''),
            verificationRef: String(verification.verificationRef ?? ''),
          },
          expiresAt:
            recognitionInput.expiresAt === null ? null : String(recognitionInput.expiresAt ?? ''),
          revocation: null,
        });

        await insertRecognition(recognition);

        return res.status(201).json({ recognitionId: recognition.recognitionId });
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        log('error', 'failed to create recognition', {
          event: 'recognition_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
        return res.status(500).json({ error: 'Unable to record recognition event.' });
      }
    },
  );

  app.get(
    '/recognitions/:recognitionId',
    param('recognitionId').isString().withMessage('recognitionId is required'),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const recognitionId = String(req.params.recognitionId || '').trim();
        const recognition = await getRecognitionById(recognitionId);
        
        if (!recognition) {
          return res.status(404).json({ error: 'Recognition not found' });
        }

        return res.json({ recognition });
      } catch (error) {
        log('error', 'failed to fetch recognition', {
          event: 'get_recognition_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
        return res.status(500).json({ error: 'Unable to fetch recognition.' });
      }
    },
  );

  app.post(
    '/acceptances',
    apiKeyAuth,
    body('acceptance').isObject().withMessage('acceptance is required'),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const acceptanceInput = parseObjectField(
          (req.body as { acceptance?: unknown }).acceptance,
          'acceptance',
        );

        if ('acceptanceId' in acceptanceInput) {
          throw new DomainError(
            'acceptanceId is generated and must not be provided',
            'ID_PROVIDED',
          );
        }

        const recognitionId = String(acceptanceInput.recognitionId ?? '').trim();
        if (!recognitionId) {
          throw new DomainError('acceptance.recognitionId is required', 'MISSING_FIELD');
        }

        const recognition = await getRecognitionById(recognitionId);
        if (!recognition) {
          return res.status(404).json({ error: 'RecognitionEvent not found', recognitionId });
        }

        const unresolvedConflict = await prisma.auditEvent.findFirst({
          where: {
            type: 'INGEST_CONFLICT_DETECTED',
            clinicianId: recognition.subjectId,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (unresolvedConflict) {
          throw new DomainError('Acceptance blocked: Identity conflict detected', 'IDENTITY_CONFLICT');
        }

        const psvReportId = parseOptionalString(acceptanceInput.psvReportId);
        if (!psvReportId) {
          await emitRejectionAuditEvent({
            type: 'EMPLOYER_ACCEPTANCE_REJECTED',
            credentialId: recognitionId,
            metadata: {
              clinician_id: recognition.subjectId,
              recognitionId: recognition.recognitionId,
              reason: 'MISSING_PSV_REPORT_ID',
              message: 'Acceptance requires completed PSV.',
              rejectedAt: new Date().toISOString(),
            },
          });
          return res.status(409).json({
            error: 'Acceptance requires completed PSV.',
            code: 'MISSING_PSV',
          });
        }

        const recognitionPsvRef = parseOptionalString(recognition.verification?.verificationRef);
        if (!recognitionPsvRef) {
          await emitRejectionAuditEvent({
            type: 'EMPLOYER_ACCEPTANCE_REJECTED',
            credentialId: recognitionId,
            metadata: {
              clinician_id: recognition.subjectId,
              recognitionId: recognition.recognitionId,
              psvReportId,
              reason: 'MISSING_PSV_REFERENCE',
              message: 'Acceptance requires completed PSV.',
              rejectedAt: new Date().toISOString(),
            },
          });
          return res.status(409).json({
            error: 'Acceptance requires completed PSV.',
            code: 'MISSING_PSV',
          });
        }

        assertCanAccept(recognition);

        const acceptance = new EmployerAcceptance({
          recognitionId: recognition.recognitionId,
          subjectId: recognition.subjectId,
          employerId: String(acceptanceInput.employerId || recognition.employerId),
          facilityId: String(acceptanceInput.facilityId ?? ''),
          acceptedAt: String(acceptanceInput.acceptedAt ?? ''),
          psvReportId,
        });

        await insertAcceptance(acceptance);

        return res.status(201).json({ acceptanceId: acceptance.acceptanceId });
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        log('error', 'failed to create acceptance', {
          event: 'acceptance_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
        return res.status(500).json({ error: 'Unable to record acceptance event.' });
      }
    },
  );

  app.post(
    '/starts',
    apiKeyAuth,
    body('start').isObject().withMessage('start is required'),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const startInput = parseObjectField((req.body as { start?: unknown }).start, 'start');

        if ('startId' in startInput) {
          throw new DomainError('startId is generated and must not be provided', 'ID_PROVIDED');
        }

        const acceptanceId = String(startInput.acceptanceId ?? '').trim();
        if (!acceptanceId) {
          throw new DomainError('start.acceptanceId is required', 'MISSING_FIELD');
        }

        const acceptance = await getAcceptanceById(acceptanceId);
        if (!acceptance) {
          return res.status(404).json({ error: 'EmployerAcceptance not found', acceptanceId });
        }

        const recognition = await getRecognitionById(acceptance.recognitionId);
        if (!recognition) {
          return res.status(404).json({
            error: 'RecognitionEvent not found',
            recognitionId: acceptance.recognitionId,
          });
        }

        if (!parseOptionalString(acceptance.psvReportId)) {
          const message = 'Start blocked: Acceptance requires completed PSV.';
          await emitRejectionAuditEvent({
            type: 'START_REJECTED',
            credentialId: acceptanceId,
            metadata: {
              clinician_id: acceptance.subjectId,
              acceptanceId: acceptance.acceptanceId,
              recognitionId: recognition.recognitionId,
              reason: 'MISSING_PSV_REPORT_ID',
              message,
              rejectedAt: new Date().toISOString(),
            },
          });
          return res.status(409).json({ error: message, code: 'MISSING_PSV' });
        }

        const psvReference = parseOptionalString(recognition.verification?.verificationRef);
        if (!psvReference) {
          const message = 'Start blocked: Missing required PSV.';
          await emitRejectionAuditEvent({
            type: 'START_REJECTED',
            credentialId: acceptanceId,
            metadata: {
              clinician_id: acceptance.subjectId,
              acceptanceId: acceptance.acceptanceId,
              recognitionId: recognition.recognitionId,
              reason: 'MISSING_PSV_REFERENCE',
              message,
              rejectedAt: new Date().toISOString(),
            },
          });
          return res.status(409).json({ error: message, code: 'MISSING_PSV' });
        }

        if (recognition.revocation) {
          const message = 'Start blocked: PSV receipt is revoked.';
          await emitRejectionAuditEvent({
            type: 'START_REJECTED',
            credentialId: acceptanceId,
            metadata: {
              clinician_id: acceptance.subjectId,
              acceptanceId: acceptance.acceptanceId,
              recognitionId: recognition.recognitionId,
              reason: 'REVOKED_PSV',
              message,
              rejectedAt: new Date().toISOString(),
            },
          });
          return res.status(409).json({ error: message, code: 'REVOKED_PSV' });
        }

        if (recognition.expiresAt) {
          const expiresAtMs = Date.parse(recognition.expiresAt);
          if (!Number.isNaN(expiresAtMs) && Date.now() > expiresAtMs) {
            const message = 'Start blocked: PSV receipt is expired.';
            await emitRejectionAuditEvent({
              type: 'START_REJECTED',
              credentialId: acceptanceId,
              metadata: {
                clinician_id: acceptance.subjectId,
                acceptanceId: acceptance.acceptanceId,
                recognitionId: recognition.recognitionId,
                expiresAt: recognition.expiresAt,
                reason: 'EXPIRED_PSV',
                message,
                rejectedAt: new Date().toISOString(),
              },
            });
            return res.status(409).json({ error: message, code: 'EXPIRED_PSV' });
          }
        }

        if (neo4jConfigured()) {
          try {
            const readiness = await getReadinessScore(acceptance.subjectId);
            const factors = readiness.factors as Record<string, unknown>;
            const sanctions = Number(factors?.sanctions ?? 0);
            if (Number.isFinite(sanctions) && sanctions > 0) {
              const message = 'Start blocked: Active sanctions detected.';
              await emitRejectionAuditEvent({
                type: 'START_REJECTED',
                credentialId: acceptanceId,
                metadata: {
                  clinician_id: acceptance.subjectId,
                  acceptanceId: acceptance.acceptanceId,
                  recognitionId: recognition.recognitionId,
                  reason: 'ACTIVE_SANCTIONS',
                  sanctions,
                  message,
                  rejectedAt: new Date().toISOString(),
                },
              });
              return res.status(409).json({ error: message, code: 'ACTIVE_SANCTIONS' });
            }
          } catch {
            const message = 'Start blocked: Unable to compute trust-state.';
            await emitRejectionAuditEvent({
              type: 'START_REJECTED',
              credentialId: acceptanceId,
              metadata: {
                clinician_id: acceptance.subjectId,
                acceptanceId: acceptance.acceptanceId,
                recognitionId: recognition.recognitionId,
                reason: 'TRUST_STATE_UNAVAILABLE',
                message,
                rejectedAt: new Date().toISOString(),
              },
            });
            return res.status(409).json({ error: message, code: 'TRUST_STATE_UNAVAILABLE' });
          }
        }

        const priorStarts = await listStartsByAcceptanceId(acceptanceId);
        assertCanStart(acceptance, priorStarts);

        const start = new StartAttestation({
          acceptanceId: acceptance.acceptanceId,
          subjectId: acceptance.subjectId,
          employerId: acceptance.employerId,
          attestedAt: String(startInput.attestedAt ?? ''),
        });

        await insertStart(start);

        return res.status(201).json({ startId: start.startId });
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        log('error', 'failed to create start', {
          event: 'start_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
        return res.status(500).json({ error: 'Unable to record start attestation.' });
      }
    },
  );

  app.get(
    '/status/:subject_id',
    param('subject_id').isString().withMessage('subject_id is required'),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const subjectId = String(req.params.subject_id || '').trim();
        if (!subjectId) {
          throw new DomainError('subject_id is required', 'MISSING_FIELD');
        }

        const [recognitions, acceptances, starts] = await Promise.all([
          listRecognitionsBySubject(subjectId),
          listAcceptancesBySubject(subjectId),
          listStartsBySubject(subjectId),
        ]);

        return res.json(subjectStatus({ recognitions, acceptances, starts }));
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        log('error', 'Unable to load subject status', {
          event: 'subject_status_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
        return res.status(500).json({ error: 'Unable to load subject status.' });
      }
    },
  );

  app.get(
    '/trust-state',
    async (req: Request, res: Response) => {
      try {
        const clinicianId = String(req.query.clinician_id || '').trim();
        const employerId = req.query.employer_id ? String(req.query.employer_id).trim() : undefined;
        const simulateDecay = req.query.simulate_decay === 'true';

        if (!clinicianId) {
           return res.status(400).json({ error: 'clinician_id query parameter is required' });
        }

        const [recognitions, allAcceptances, starts] = await Promise.all([
          listRecognitionsBySubject(clinicianId),
          listAcceptancesBySubject(clinicianId),
          listStartsBySubject(clinicianId),
        ]);

        // If employerId is provided, filter acceptances to simulate perspective of that employer
        const acceptances = employerId 
          ? allAcceptances.filter(a => a.employerId === employerId)
          : allAcceptances;

        const status = subjectStatus({ recognitions, acceptances, starts });
        
        const currentRecognition = status.recognitionId
          ? recognitions.find((recognition) => recognition.recognitionId === status.recognitionId)
          : undefined;
        const currentAcceptance = status.acceptanceId
          ? allAcceptances.find((acceptance) => acceptance.acceptanceId === status.acceptanceId)
          : undefined;

        let crs = { score: 0, band: 'RED', factors: {} as Record<string, unknown> };
        const blocking_reasons: string[] = [];

        if (neo4jConfigured()) {
          try {
            const readiness = await getReadinessScore(clinicianId);
            crs = {
              score: readiness.score,
              band: readiness.score >= 80 ? 'GREEN' : readiness.score >= 50 ? 'YELLOW' : 'RED',
              factors: readiness.factors,
            };
          } catch {
            // Fail closed by keeping CRS in RED when readiness cannot be computed.
          }
        }

        const hasPsvReference = Boolean(
          parseOptionalString(currentRecognition?.verification?.verificationRef),
        );
        const isRevoked = Boolean(currentRecognition?.revocation);
        const isExpired = Boolean(
          currentRecognition?.expiresAt &&
            !Number.isNaN(Date.parse(currentRecognition.expiresAt)) &&
            Date.now() > Date.parse(currentRecognition.expiresAt),
        );

        if (!hasPsvReference) {
          blocking_reasons.push('MISSING_PSV');
        }
        if (isExpired) {
          blocking_reasons.push('EXPIRED_PSV');
        }
        if (isRevoked) {
          blocking_reasons.push('REVOKED_PSV');
        }

        if (!status.recognized) {
          blocking_reasons.push('MISSING_RECOGNITION');
        }
        if (!status.accepted) {
          blocking_reasons.push('MISSING_ACCEPTANCE');
        }
        if (status.started) {
          blocking_reasons.push('START_ALREADY_ATTESTED');
        }

        const factors = crs.factors as Record<string, unknown>;
        const sanctions = Number(factors?.sanctions ?? 0);
        if (Number.isFinite(sanctions) && sanctions > 0) {
          blocking_reasons.push('ACTIVE_SANCTIONS');
        }
        const activeLicenses = Number(factors?.activeLicenses ?? 1);
        if (Number.isFinite(activeLicenses) && activeLicenses === 0) {
          blocking_reasons.push('NO_ACTIVE_LICENSE');
        }

        if (simulateDecay) {
          blocking_reasons.push('VERIFICATION_EXPIRED', 'EXPIRED_PSV');
          crs.score = 40;
          crs.band = 'RED';
        }

        const psvInvalidatesTrust = blocking_reasons.some((reason) =>
          ['MISSING_PSV', 'EXPIRED_PSV', 'REVOKED_PSV', 'ACTIVE_SANCTIONS'].includes(reason),
        );
        if (psvInvalidatesTrust) {
          crs.band = 'RED';
          if (crs.score >= 80) {
            crs.score = 79;
          }
        }

        if (crs.score < 80 || crs.band !== 'GREEN') {
          blocking_reasons.push('CRS_BELOW_THRESHOLD');
        }

        const dedupedBlockingReasons = [...new Set(blocking_reasons)];
        const start_ready = dedupedBlockingReasons.length === 0 && status.accepted && !status.started;

        const timeline_preview: Array<{
          id: string;
          type:
            | 'INGESTED'
            | 'VERIFICATION_REQUESTED'
            | 'VERIFICATION_COMPLETED'
            | 'VERIFICATION_FAILED'
            | 'ACCEPTED'
            | 'STARTED'
            | 'DECAYED';
          label: string;
          timestamp: string;
          employer: string | null;
          facility: string | null;
          metadata: Record<string, unknown>;
        }> = [];

        if (currentRecognition && hasPsvReference) {
          timeline_preview.push({
            id: currentRecognition.recognitionId,
            type: 'VERIFICATION_COMPLETED',
            label: 'Verification completed',
            timestamp: currentRecognition.recognizedAt,
            employer: currentRecognition.employerId,
            facility: null,
            metadata: {
              subject: currentRecognition.subjectId,
              psv_report_id: currentRecognition.verification.verificationRef,
              expires: currentRecognition.expiresAt,
            },
          });
        }

        allAcceptances.forEach((acceptance) => {
          timeline_preview.push({
            id: acceptance.acceptanceId,
            type: 'ACCEPTED',
            label: 'Employer accepted',
            timestamp: acceptance.acceptedAt,
            employer: acceptance.employerId,
            facility: acceptance.facilityId,
            metadata: {
              recognitionId: acceptance.recognitionId,
              psvReportId: acceptance.psvReportId,
            },
          });
        });

        starts.forEach((start) => {
          timeline_preview.push({
            id: start.startId,
            type: 'STARTED',
            label: 'Work started',
            timestamp: start.attestedAt,
            employer: start.employerId,
            facility: null,
            metadata: {
              acceptanceId: start.acceptanceId,
            },
          });
        });

        if (simulateDecay || isExpired || isRevoked) {
          timeline_preview.push({
            id: 'trust-decay',
            type: 'DECAYED',
            label: 'Trust decayed',
            timestamp: new Date().toISOString(),
            employer: currentRecognition?.employerId ?? null,
            facility: currentAcceptance?.facilityId ?? null,
            metadata: {
              reason: isRevoked ? 'REVOKED_PSV' : 'EXPIRED_PSV',
              trigger: simulateDecay ? 'Simulation' : 'PSV freshness check',
            },
          });
        }

        timeline_preview.sort((left, right) => {
          const leftTs = Date.parse(left.timestamp);
          const rightTs = Date.parse(right.timestamp);
          return rightTs - leftTs;
        });

        return res.json({
          ...status,
          start_ready,
          crs,
          blocking_reasons: dedupedBlockingReasons,
          timeline_preview: timeline_preview.slice(0, 5),
          acceptanceDetails: currentAcceptance
            ? {
                employerId: currentAcceptance.employerId,
                facilityId: currentAcceptance.facilityId,
                role: 'Unspecified',
                acceptedAt: currentAcceptance.acceptedAt,
              }
            : null,
        });
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        log('error', 'failed to evaluate trust-state', {
          event: 'trust_state_error',
          error: error instanceof Error ? error.message : 'unknown',
        });
         return res.status(500).json({ error: 'Unable to compute trust-state.' });
      }
    }
  );
}
