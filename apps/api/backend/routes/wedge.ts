import type { Express, Request, Response } from 'express';
import { body, param } from 'express-validator';
import { DomainError } from '../../../../packages/domain-common/src/errors/DomainError';
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
import { validateRequest } from '../src/middleware/validateRequest';

function respondDomainError(res: Response, error: DomainError) {
  const status = error.code === 'START_EXISTS' ? 409 : 400;
  return res.status(status).json({ error: error.message, code: error.code });
}

function parseObjectField(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    throw new DomainError(`${field} is required`, 'MISSING_FIELD');
  }
  return value as Record<string, unknown>;
}

export function registerWedgeRoutes(app: Express) {
  app.post(
    '/recognitions',
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
        console.error('recognition error:', error);
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
        console.error('get recognition error:', error);
        return res.status(500).json({ error: 'Unable to fetch recognition.' });
      }
    },
  );

  app.post(
    '/acceptances',
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

        assertCanAccept(recognition);

        const acceptance = new EmployerAcceptance({
          recognitionId: recognition.recognitionId,
          subjectId: recognition.subjectId,
          employerId: String(acceptanceInput.employerId || recognition.employerId),
          facilityId: String(acceptanceInput.facilityId ?? ''),
          acceptedAt: String(acceptanceInput.acceptedAt ?? ''),
        });

        await insertAcceptance(acceptance);

        return res.status(201).json({ acceptanceId: acceptance.acceptanceId });
      } catch (error) {
        if (error instanceof DomainError) return respondDomainError(res, error);
        console.error('acceptance error:', error);
        return res.status(500).json({ error: 'Unable to record acceptance event.' });
      }
    },
  );

  app.post(
    '/starts',
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
        console.error('start error:', error);
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
        console.error('status error:', error);
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
        
        // Find the specific acceptance if available
        const currentAcceptance = status.acceptanceId 
          ? allAcceptances.find(a => a.acceptanceId === status.acceptanceId)
          : undefined;

        // Enhance with Trust State logic (CRS, blocking reasons, start_ready)
        let crs = { score: 0, band: 'UNKNOWN', factors: {} as Record<string, unknown> };
        const blocking_reasons: string[] = [];
        
        if (neo4jConfigured()) {
            try {
                const readiness = await getReadinessScore(clinicianId);
                crs = {
                    score: readiness.score,
                    band: readiness.score >= 80 ? 'GREEN' : readiness.score >= 50 ? 'YELLOW' : 'RED',
                    factors: readiness.factors,
                };
            } catch (e) {
                console.warn('Failed to fetch readiness score for trust state', e);
            }
        }

        // Simulate Decay
        if (simulateDecay) {
          crs.score = 40;
          crs.band = 'RED';
          if (!crs.factors) crs.factors = {};
          // Maybe simulate a factor?
        }

        // Trust Logic Replicated from TrustStateResolver (simplified for wedge)
        if (!status.recognized) {
            blocking_reasons.push('MISSING_RECOGNITION');
        } else if (!status.accepted) {
            blocking_reasons.push('MISSING_ACCEPTANCE');
        } else if (status.started) {
            blocking_reasons.push('START_ALREADY_ATTESTED');
        }

        // CRS Checks
        if (crs.score < 80 || crs.band !== 'GREEN') {
             blocking_reasons.push('CRS_BELOW_THRESHOLD');
        }

        // Specifically for decay simulation
        if (simulateDecay) {
          blocking_reasons.push('VERIFICATION_EXPIRED');
        }
        
        const factors = crs.factors as any;
        if (factors?.sanctions > 0) blocking_reasons.push('ACTIVE_SANCTIONS');
        if (factors?.activeLicenses === 0) blocking_reasons.push('NO_ACTIVE_LICENSE');

        // Derived start_ready: Must be accepted, not yet started, and no blocking reasons
        // Note: MISSING_ACCEPTANCE is a blocking reason, so checking blocking_reasons.length === 0 covers it.
        // Derived start_ready: Must be accepted, not yet started, and no blocking reasons
        // Note: MISSING_ACCEPTANCE is a blocking reason, so checking blocking_reasons.length === 0 covers it.
        const start_ready = status.accepted && !status.started && blocking_reasons.filter(r => r !== 'MISSING_ACCEPTANCE' && r !== 'START_ALREADY_ATTESTED').length === 0;

        // Create Audit Timeline
        const timeline_preview: any[] = [];

        recognitions.forEach(r => {
          timeline_preview.push({
            id: r.recognitionId,
            type: 'VERIFIED',
            label: 'Network Verified',
            timestamp: r.recognizedAt,
            employer: r.employerId, // Note: This might be the network ID or null in some models
            facility: null,
            metadata: { 
               subject: r.subjectId, 
               expires: r.expiresAt 
            }
          });
        });

        allAcceptances.forEach(a => {
          timeline_preview.push({
            id: a.acceptanceId,
            type: 'ACCEPTED',
            label: 'Employer Accepted',
            timestamp: a.acceptedAt,
            employer: a.employerId,
            facility: a.facilityId,
            metadata: {
               recognitionId: a.recognitionId
            }
          });
        });

        starts.forEach(s => {
           timeline_preview.push({
             id: s.startId,
             type: 'STARTED',
             label: 'Work Started',
             timestamp: s.attestedAt,
             employer: s.employerId, // Start usually inherits employer
             facility: null, // Start might not track facility directly but Acceptance does
             metadata: {
                acceptanceId: s.acceptanceId
             }
           });
        });

        // Add Decay Event if simulated
        if (simulateDecay) {
           timeline_preview.push({
             id: 'sim-decay-001',
             type: 'DECAYED',
             label: 'Trust Decayed',
             timestamp: new Date().toISOString(),
             employer: null,
             facility: null,
             metadata: {
                reason: 'VERIFICATION_EXPIRED',
                trigger: 'Time-to-live exceeded'
             }
           });
        }

        // Sort by timestamp desc
        timeline_preview.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Take top 5
        const limited_timeline = timeline_preview.slice(0, 5);

        return res.json({
            ...status,
            start_ready,
            crs,
            blocking_reasons,
            timeline_preview: limited_timeline,
            // Extra fields for UX
            acceptanceDetails: currentAcceptance ? {
              employerId: currentAcceptance.employerId,
              facilityId: currentAcceptance.facilityId,
              role: "Registered Nurse", // Hardcoded for demo
              acceptedAt: currentAcceptance.acceptedAt
            } : null
        });
      } catch (error) {
         if (error instanceof DomainError) return respondDomainError(res, error);
         console.error('trust-state error:', error);
         return res.status(500).json({ error: 'Unable to load trust state.' });
      }
    }
  );
}
