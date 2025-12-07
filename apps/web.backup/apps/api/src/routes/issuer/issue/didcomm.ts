import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { z } from 'zod';
import { didcommFailover } from '../../../services/didcomm/fallback';
import { recordThreadTrace } from '../../../services/didcomm/tracer';
import { createAnchor } from '../../../services/verify/anchor';
import { assertKillSwitchAllows, KillSwitchError } from '../../services/security/kill-switch';
import {
  assertIssuanceAllowed,
  ForensicsLockError,
} from '../../../services/forensics/score';
import {
  validateIssuerAntiSpoof,
  type DidDocumentSummary,
} from '../../../services/issuer/anti-spoof-validator';
import { buildSignedAgentEnvelope } from '../../../services/aries/message-signer';

const router = Router();

const IssueRequestSchema = z.object({
  connectionId: z.string().min(1),
  credentialSubject: z.record(z.any()),
  schemaId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const ACAPY_URL = process.env.ACAPY_URL || 'http://localhost:8031';
const ISSUER_DID = process.env.ISSUER_DID || 'did:web:vitalcv.example/issuer';

router.post('/issue/didcomm', async (req: Request, res: Response) => {
  try {
    assertKillSwitchAllows('issuance');
  } catch (error) {
    if (error instanceof KillSwitchError) {
      return res.status(503).json({
        error: 'kill_switch_engaged',
        message: error.message,
        killSwitch: error.state,
      });
    }
    throw error;
  }

  const parsed = IssueRequestSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: 'invalid_request',
      details: parsed.error.flatten(),
    });
  }

  const payload = parsed.data;
  const clinicianId = extractClinicianId(payload.credentialSubject) ?? null;

  if (clinicianId) {
    try {
      await assertIssuanceAllowed(clinicianId);
    } catch (error) {
      if (error instanceof ForensicsLockError) {
        return res.status(423).json({
          error: 'forensics_lock',
          message: error.message,
          clinicianId: error.clinicianId,
          riskScore: error.riskScore,
          threshold: error.threshold,
        });
      }
      throw error;
    }
  }
  const fingerprint = req.get('x-mtls-fingerprint') ?? req.get('x-arr-clientcert') ?? null;
  const didDocument = await resolveIssuerDidDocument(ISSUER_DID).catch(() => null);
  const antiSpoofVerdict = validateIssuerAntiSpoof({
    issuerDid: ISSUER_DID,
    didDocument,
    mtlsFingerprint: fingerprint,
  });

  if (!antiSpoofVerdict.accepted) {
    return res.status(428).json({
      error: 'issuer_anti_spoof',
      message: 'Issuer channel failed anti-spoof validation',
      verdict: antiSpoofVerdict,
    });
  }

  const credential = buildCredential(payload);
  const message = buildDidcommMessage(payload.connectionId, credential, payload.metadata);

  try {
    const endpoint = `${ACAPY_URL}/connections/${payload.connectionId}/send-message`;
    const envelope = buildSignedAgentEnvelope(message, { agentId: ISSUER_DID });
    await didcommFailover.send(endpoint, envelope);

    const anchor = createAnchor(
      [credential.id, credential.credentialSubject?.id ?? payload.connectionId],
      'issue',
    );
    await recordThreadTrace({
      threadId: message.thid ?? message.id,
      parentThreadId: message.pthid,
      auditEventId: anchor.anchorId,
      messageType: message.type,
      connectionId: payload.connectionId,
      metadata: {
        credentialId: credential.id,
        schemaId: credential.credentialSchema?.id,
        auditId: envelope.auditId,
      },
      status: 'queued',
    });

    return res.status(202).json({
      messageId: message.id,
      anchor,
      status: 'queued',
      auditId: envelope.auditId,
      antiSpoofVerdict,
    });
  } catch (error) {
    console.error('[issuer:didcomm] failed to send message', error);
    return res.status(502).json({
      error: 'didcomm_send_failed',
      message: error instanceof Error ? error.message : 'Unable to reach ACA-Py',
    });
  }
});

export function buildCredential(input: z.infer<typeof IssueRequestSchema>) {
  const issuanceDate = new Date().toISOString();
  const id = input.credentialSubject.id || `urn:vc:${randomUUID()}`;
  return {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    id,
    type: ['VerifiableCredential', input.schemaId ?? 'VitalCredential'],
    issuer: ISSUER_DID,
    issuanceDate,
    credentialSchema: input.schemaId
      ? {
          id: input.schemaId,
          type: 'JsonSchemaValidator2018',
        }
      : undefined,
    credentialSubject: input.credentialSubject,
  };
}

export function buildDidcommMessage(
  connectionId: string,
  credential: Record<string, any>,
  metadata?: any,
) {
  const messageId = randomUUID();
  return {
    id: messageId,
    thid: messageId,
    type: 'https://didcomm.org/issue-credential/3.0/offer-credential',
    from: ISSUER_DID,
    to: [connectionId],
    created_time: new Date().toISOString(),
    body: {
      goal_code: 'vitalcv.credential.issue',
      comment: 'VitalCV automated issue',
    },
    attachments: [
      {
        id: 'cred-0',
        format: 'application/vc+ld+json',
        media_type: 'application/json',
        data: {
          json: credential,
        },
      },
    ],
    '~transport': {
      return_route: 'all',
    },
    ...(metadata ? { '~please_ack': metadata } : {}),
  };
}

export default router;

function extractClinicianId(subject: Record<string, unknown>): string | null {
  const directId = subject?.clinicianId;
  if (typeof directId === 'string' && directId.trim()) {
    return directId.trim();
  }
  if (typeof subject?.id === 'string') {
    const match = subject.id.match(/clinician[-/:](?<id>[A-Za-z0-9-]+)/i);
    if (match?.groups?.id) {
      return match.groups.id;
    }
  }
  if (typeof subject?.holder === 'string') {
    const holder = subject.holder as string;
    const match = holder.match(/clinician[-/:](?<id>[A-Za-z0-9-]+)/i);
    if (match?.groups?.id) {
      return match.groups.id;
    }
  }
  return null;
}

async function resolveIssuerDidDocument(issuerDid: string): Promise<DidDocumentSummary | null> {
  if (!issuerDid.startsWith('did:web:')) {
    return null;
  }
  const path = issuerDid.replace('did:web:', '').split(':').join('/');
  const url = `https://${path}/.well-known/did.json`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Resolver returned ${response.status}`);
    }
    return (await response.json()) as DidDocumentSummary;
  } catch (error) {
    console.warn('[issuer][didcomm] unable to resolve DID document', error);
    return null;
  }
}


