import { createHmac, randomUUID } from 'crypto';

const DEFAULT_SECRET = process.env.AGENT_SIGNING_SECRET || 'dev-agent-signing-secret';

export interface AgentEnvelope<TPayload = Record<string, unknown>> {
  auditId: string;
  agentId: string;
  issuedAt: string;
  version: 'v2';
  payload: TPayload;
  signature: {
    alg: 'HS256';
    digest: string;
  };
}

export interface EnvelopeOptions {
  agentId?: string;
  secret?: string;
}

export function buildSignedAgentEnvelope<TPayload>(
  payload: TPayload,
  options: EnvelopeOptions = {},
): AgentEnvelope<TPayload> {
  const agentId = options.agentId ?? 'issuer-service';
  const issuedAt = new Date().toISOString();
  const auditId = randomUUID();
  const version: AgentEnvelope['version'] = 'v2';

  const snapshot = serializeEnvelope({ payload, agentId, issuedAt, auditId, version });
  const digest = createHmac('sha256', options.secret ?? DEFAULT_SECRET).update(snapshot).digest('hex');

  return {
    auditId,
    agentId,
    issuedAt,
    version,
    payload,
    signature: {
      alg: 'HS256',
      digest,
    },
  };
}

export function verifySignedEnvelope(
  envelope: AgentEnvelope,
  secret: string = DEFAULT_SECRET,
): boolean {
  const snapshot = serializeEnvelope({
    payload: envelope.payload,
    agentId: envelope.agentId,
    issuedAt: envelope.issuedAt,
    auditId: envelope.auditId,
    version: envelope.version,
  });
  const expected = createHmac('sha256', secret).update(snapshot).digest('hex');
  return timingSafeEqual(expected, envelope.signature.digest);
}

function serializeEnvelope(data: {
  payload: unknown;
  agentId: string;
  issuedAt: string;
  auditId: string;
  version: string;
}): string {
  return JSON.stringify({
    payload: data.payload,
    agentId: data.agentId,
    issuedAt: data.issuedAt,
    auditId: data.auditId,
    version: data.version,
  });
}

function timingSafeEqual(expected: string, provided: string): boolean {
  if (expected.length !== provided.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return mismatch === 0;
}



