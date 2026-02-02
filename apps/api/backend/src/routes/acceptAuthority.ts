import type { Express, Request, Response } from 'express';
import { body } from 'express-validator';
import crypto from 'crypto';
import prisma from '../graphql/prisma_client';
import { validateRequest } from '../middleware/validateRequest';

type AcceptingEntity = {
  entityId?: string;
  name: string;
  did?: string;
  type: 'employer' | 'facility' | 'payer' | 'issuer' | 'other';
};

type AuthorityEventPayload = {
  authorityId: string;
  subjectDid: string;
  issuerDid: string;
  issuerName: string;
  issuerType: string;
  authorityType?: string;
  issuedAt: string;
  expiresAt?: string | null;
  hashAnchor: string;
  credential?: {
    credentialId?: string;
    type?: string;
    title?: string;
    status?: string;
    facility?: {
      facilityId?: string;
      name?: string;
      npi?: string;
      location?: string;
    };
  };
  facility?: {
    facilityId?: string;
    name?: string;
    npi?: string;
    location?: string;
  };
};

type AuthorityAcceptanceEvent = {
  acceptanceId: string;
  authorityId: string;
  acceptedBy: AcceptingEntity;
  acceptedAt: string;
  decision: 'ACCEPTED';
  authorityHash: string;
  hashAnchor: string;
};

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type AcceptingEntityInput = {
  entityId?: unknown;
  name?: unknown;
  did?: unknown;
  type?: unknown;
};

function resolveAcceptedBy(
  authorityEvent: AuthorityEventPayload,
  acceptor: AcceptingEntityInput | null | undefined
): AcceptingEntity {
  const facilityFallback =
    authorityEvent.facility && isNonEmptyString(authorityEvent.facility.name)
      ? {
          entityId: authorityEvent.facility.facilityId,
          name: authorityEvent.facility.name,
          type: 'facility' as const,
        }
      : null;

  const fallback: AcceptingEntity = facilityFallback ?? {
    name: 'Employer Reviewer',
    type: 'employer',
  };

  const allowedTypes = new Set(['employer', 'facility', 'payer', 'issuer', 'other']);
  const acceptorType =
    acceptor && isNonEmptyString(acceptor.type) && allowedTypes.has(acceptor.type)
      ? (acceptor.type as AcceptingEntity['type'])
      : fallback.type;

  const acceptorName = acceptor && isNonEmptyString(acceptor.name) ? acceptor.name : fallback.name;
  const acceptorEntityId =
    acceptor && isNonEmptyString(acceptor.entityId) ? acceptor.entityId : fallback.entityId;
  const acceptorDid = acceptor && isNonEmptyString(acceptor.did) ? acceptor.did : undefined;

  return {
    name: acceptorName,
    type: acceptorType,
    entityId: acceptorEntityId,
    did: acceptorDid,
  };
}

async function writeAuditEvent(event: {
  type: string;
  credentialId?: string;
  userId?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ hash: string; createdAt: string }> {
  const createdAt = new Date();
  const hash = sha256Hex(
    JSON.stringify({
      type: event.type,
      credentialId: event.credentialId || null,
      userId: event.userId || null,
      createdAt: createdAt.toISOString(),
      metadata: event.metadata || null,
    })
  );

  await prisma.auditEvent.create({
    data: {
      type: event.type,
      hash,
      credentialId: event.credentialId,
      userId: event.userId,
      metadata: event.metadata ?? undefined,
      createdAt,
    },
  });

  return { hash, createdAt: createdAt.toISOString() };
}

export function registerAuthorityAcceptanceRoute(app: Express) {
  app.post(
    '/authority/accept',
    body('authorityEvent').isObject().withMessage('authorityEvent is required'),
    body('authorityEvent.authorityId').isString().withMessage('authorityId is required'),
    body('authorityEvent.subjectDid').isString().withMessage('subjectDid is required'),
    body('authorityEvent.issuerDid').isString().withMessage('issuerDid is required'),
    body('authorityEvent.issuerName').isString().withMessage('issuerName is required'),
    body('authorityEvent.issuerType').isString().withMessage('issuerType is required'),
    body('authorityEvent.issuedAt').isString().withMessage('issuedAt is required'),
    body('authorityEvent.hashAnchor').isString().withMessage('hashAnchor is required'),
    body('acceptor').optional().isObject(),
    body('acceptor.name').optional().isString(),
    body('acceptor.type').optional().isString(),
    body('acceptor.entityId').optional().isString(),
    body('acceptor.did').optional().isString(),
    validateRequest,
    async (req: Request, res: Response) => {
      try {
        const { authorityEvent, acceptor } = req.body as {
          authorityEvent: AuthorityEventPayload;
          acceptor?: Record<string, unknown>;
        };

        if (!authorityEvent || !isNonEmptyString(authorityEvent.authorityId)) {
          return res.status(400).json({ error: 'authorityEvent.authorityId is required' });
        }

        if (!isNonEmptyString(authorityEvent.hashAnchor)) {
          return res.status(400).json({ error: 'authorityEvent.hashAnchor is required' });
        }

        const acceptedAt = new Date().toISOString();
        const acceptedBy = resolveAcceptedBy(authorityEvent, acceptor);
        const acceptedByKey =
          acceptedBy.entityId || acceptedBy.did || acceptedBy.name || 'unknown-acceptor';

        const acceptanceId = sha256Hex(
          `accept:${authorityEvent.authorityId}:${acceptedByKey}:${acceptedAt}`
        ).slice(0, 32);

        const acceptancePayload = {
          acceptanceId,
          authorityId: authorityEvent.authorityId,
          acceptedBy,
          acceptedAt,
          decision: 'ACCEPTED' as const,
          authorityHash: authorityEvent.hashAnchor,
        };

        const hashAnchor = sha256Hex(JSON.stringify(acceptancePayload));
        const acceptance: AuthorityAcceptanceEvent = {
          ...acceptancePayload,
          hashAnchor,
        };

        const audit = await writeAuditEvent({
          type: 'AUTHORITY_ACCEPTED',
          credentialId: authorityEvent.credential?.credentialId,
          metadata: {
            authorityId: authorityEvent.authorityId,
            authorityHash: authorityEvent.hashAnchor,
            issuerName: authorityEvent.issuerName,
            issuerType: authorityEvent.issuerType,
            authorityType: authorityEvent.authorityType ?? null,
            subjectDid: authorityEvent.subjectDid,
            credential: authorityEvent.credential
              ? {
                  credentialId: authorityEvent.credential.credentialId ?? null,
                  type: authorityEvent.credential.type ?? null,
                  status: authorityEvent.credential.status ?? null,
                  title: authorityEvent.credential.title ?? null,
                  facility: authorityEvent.credential.facility
                    ? {
                        facilityId: authorityEvent.credential.facility.facilityId ?? null,
                        name: authorityEvent.credential.facility.name ?? null,
                        npi: authorityEvent.credential.facility.npi ?? null,
                        location: authorityEvent.credential.facility.location ?? null,
                      }
                    : null,
                }
              : null,
            facility: authorityEvent.facility
              ? {
                  facilityId: authorityEvent.facility.facilityId ?? null,
                  name: authorityEvent.facility.name ?? null,
                  npi: authorityEvent.facility.npi ?? null,
                  location: authorityEvent.facility.location ?? null,
                }
              : null,
            acceptance,
          },
        });

        return res.status(200).json({
          accepted: true,
          acceptance,
          auditRef: audit.hash,
          acceptedAt: audit.createdAt,
        });
      } catch (error) {
        console.error('authority accept error:', error);
        return res.status(500).json({
          error: 'Unable to accept authority event at this time.',
        });
      }
    }
  );
}
