import { TextDecoder } from 'node:util';
import { generalDecrypt, FlattenedJWE, GeneralJWE, type KeyLike } from 'jose';

const decoder = new TextDecoder();

export type DidcommMessageKind = 'offer' | 'request' | 'problem-report' | 'unknown';

export interface DidcommParserOptions {
  resolveKey?: (recipientKid?: string) => Promise<KeyLike>;
}

export interface ParsedDidcommMessage {
  id: string;
  type: string;
  kind: DidcommMessageKind;
  body?: Record<string, any>;
  attachments?: any[];
  threadId?: string;
  parentThreadId?: string;
  transport: 'plaintext' | 'encrypted';
  metadata?: Record<string, any>;
}

export class DidcommParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DidcommParserError';
  }
}

export async function parseDidcommEnvelope(
  envelope: string | Record<string, any>,
  options: DidcommParserOptions = {},
): Promise<ParsedDidcommMessage> {
  const payload = typeof envelope === 'string' ? safeJsonParse(envelope) : envelope;
  if (!payload) {
    throw new DidcommParserError('Envelope payload is empty or malformed JSON');
  }

  if (isEncryptedEnvelope(payload)) {
    const plaintext = options.resolveKey
      ? await decryptEnvelope(payload, options.resolveKey)
      : null;

    if (!plaintext) {
      return {
        id: payload.protected ?? payload.recipients?.[0]?.header?.kid ?? 'unknown',
        type: 'didcomm/enc',
        kind: 'unknown',
        transport: 'encrypted',
        metadata: {
          protected: payload.protected,
          recipients: payload.recipients?.length,
        },
      };
    }

    return buildParsedMessage(plaintext, 'encrypted');
  }

  if (!payload.type || !payload.id) {
    throw new DidcommParserError('Plaintext DIDComm message missing id/type');
  }

  return buildParsedMessage(payload, 'plaintext');
}

function safeJsonParse(value: string): Record<string, any> | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isEncryptedEnvelope(payload: Record<string, any>): payload is GeneralJWE | FlattenedJWE {
  return (
    typeof payload === 'object' &&
    (typeof payload.ciphertext === 'string' ||
      (Array.isArray(payload.recipients) && typeof payload.protected === 'string'))
  );
}

async function decryptEnvelope(
  payload: GeneralJWE | FlattenedJWE,
  resolveKey: (kid?: string) => Promise<KeyLike>,
): Promise<Record<string, any>> {
  const kid =
    (Array.isArray(payload.recipients) && payload.recipients[0]?.header?.kid) ||
    (payload as FlattenedJWE).header?.kid;
  const key = await resolveKey(kid);
  const decrypted = await generalDecrypt(payload as GeneralJWE, key).catch(async () => {
    return generalDecrypt(convertToGeneral(payload), key);
  });
  const plaintext = decoder.decode(decrypted.plaintext);
  return JSON.parse(plaintext);
}

function convertToGeneral(payload: GeneralJWE | FlattenedJWE): GeneralJWE {
  if ('recipients' in payload) {
    return payload;
  }
  return {
    protected: payload.protected,
    iv: payload.iv!,
    ciphertext: payload.ciphertext,
    tag: payload.tag!,
    recipients: [{ header: payload.header!, encrypted_key: payload.encrypted_key }],
  };
}

function buildParsedMessage(
  envelope: Record<string, any>,
  transport: ParsedDidcommMessage['transport'],
): ParsedDidcommMessage {
  const type = envelope.type as string;
  const kind = detectKind(type);
  return {
    id: envelope.id,
    type,
    kind,
    body: envelope.body,
    attachments: envelope.attachments,
    threadId: envelope?.thread?.thid ?? envelope.thid,
    parentThreadId: envelope?.thread?.pthid ?? envelope.pthid,
    transport,
  };
}

function detectKind(type?: string): DidcommMessageKind {
  if (!type) {
    return 'unknown';
  }
  const normalized = type.toLowerCase();
  if (normalized.includes('problem-report')) {
    return 'problem-report';
  }
  if (normalized.includes('offer-credential') || normalized.includes('offer_credential')) {
    return 'offer';
  }
  if (
    normalized.includes('request-credential') ||
    normalized.includes('request_presentation') ||
    normalized.includes('present-proof')
  ) {
    return 'request';
  }
  return 'unknown';
}


