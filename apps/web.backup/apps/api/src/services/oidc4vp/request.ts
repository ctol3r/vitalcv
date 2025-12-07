import { randomUUID } from 'crypto';
import { presentationSessionStore } from './store';

export interface PresentationRequestOptions {
  clientId?: string;
  credentialType?: string;
  purpose?: string;
  verifierName?: string;
}

export interface PresentationRequestPayload {
  presentation_definition: any;
  nonce: string;
  state: string;
  request_object: Record<string, unknown>;
  qr: {
    payload: string;
    request_uri: string;
  };
  dpop: {
    htm: string;
    htu: string;
    required: boolean;
  };
}

export function buildPresentationRequest(options: PresentationRequestOptions = {}): PresentationRequestPayload {
  const clientId = options.clientId ?? process.env.VERIFIER_DID ?? 'did:web:vitalcv.verifier';
  const baseUrl = resolveVerifierBaseUrl();
  const presentationDefinition = buildPresentationDefinition(options);
  const { nonce, state } = presentationSessionStore.createSession(
    presentationDefinition,
    clientId,
    options.credentialType,
  );

  const presentationEndpoint = `${baseUrl}/api/oidc4vp/presentation`;
  const requestUri = `${baseUrl}/api/oidc4vp/request/${nonce}`;

  const requestObject = {
    client_id: clientId,
    client_id_scheme: 'did',
    response_type: 'vp_token',
    response_mode: 'direct_post',
    response_uri: presentationEndpoint,
    nonce,
    state,
    presentation_definition: presentationDefinition,
  };

  const qrPayload = `openid4vp://?client_id=${encodeURIComponent(clientId)}&request_uri=${encodeURIComponent(requestUri)}`;

  return {
    presentation_definition: presentationDefinition,
    nonce,
    state,
    request_object: requestObject,
    qr: {
      payload: qrPayload,
      request_uri: requestUri,
    },
    dpop: {
      htm: 'POST',
      htu: presentationEndpoint,
      required: true,
    },
  };
}

function buildPresentationDefinition(options: PresentationRequestOptions) {
  const credentialType = options.credentialType ?? 'VerifiableCredential';
  const descriptorId = credentialType.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    id: `pd-${randomUUID()}`,
    input_descriptors: [
      {
        id: descriptorId,
        name: options.verifierName ?? 'Vital Credential Request',
        purpose: options.purpose ?? 'Demonstrate possession of the requested credential',
        constraints: {
          fields: [
            {
              path: ['$.type'],
              filter: {
                type: 'array',
                contains: { const: credentialType },
              },
            },
          ],
        },
      },
    ],
  };
}

function resolveVerifierBaseUrl(): string {
  const configured =
    process.env.OIDC4VP_VERIFIER_BASE ||
    process.env.PUBLIC_URL ||
    (process.env.VERCEL_URL?.startsWith('http') ? process.env.VERCEL_URL : undefined);
  return (configured ?? 'http://localhost:4000').replace(/\/+$/, '');
}

