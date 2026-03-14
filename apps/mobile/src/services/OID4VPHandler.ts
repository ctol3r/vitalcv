import { decodeJwt } from 'jose';

import {
  localCredentialStore,
  type LocalCredentialStore,
  type StoredCredential,
} from './LocalCredentialStore';
import {
  offlinePresentationEngine,
  type OfflinePresentation,
  type OfflinePresentationEngine,
} from './OfflinePresentationEngine';
import {
  matchesInputDescriptor,
  type DescriptorField,
  type InputDescriptorLike,
} from './internal/claimFilters';

export interface OID4VPInputDescriptor extends InputDescriptorLike {
  constraints?: {
    fields?: DescriptorField[];
  };
}

export interface OID4VPPresentationRequest {
  client_id: string;
  response_type: string;
  nonce: string;
  response_uri: string;
  presentation_definition: {
    id: string;
    name?: string;
    purpose?: string;
    input_descriptors: OID4VPInputDescriptor[];
  };
}

export interface OID4VPHandledPresentation {
  request: OID4VPPresentationRequest;
  presentation: OfflinePresentation;
  matchedCredentials: StoredCredential[];
  submitted: boolean;
  statusCode?: number;
}

function mapStoredCredentialToVpToken(credential: StoredCredential): Record<string, unknown> {
  return {
    credentialId: credential.id,
    issuer: credential.issuerDid,
    subject: credential.npi,
    claims: credential.claims,
    signature: credential.vcJwt,
    status: credential.status === 'VALID' ? 'ACTIVE' : credential.status,
    issuedAt: credential.issuedAt,
    ...(credential.expiresAt ? { expiresAt: credential.expiresAt } : {}),
    schemaVersion: '1.0',
  };
}

export class OID4VPHandler {
  constructor(
    private readonly credentialStore: LocalCredentialStore = localCredentialStore,
    private readonly presentationEngine: OfflinePresentationEngine = offlinePresentationEngine,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  parseRequest(uri: string): OID4VPPresentationRequest {
    const normalizedUri = uri.startsWith('openid4vp://') ? uri : uri.replace(/^openid4vp:/, 'openid4vp://');
    const url = new URL(normalizedUri);
    const clientId = url.searchParams.get('client_id');
    const nonce = url.searchParams.get('nonce');
    const responseUri = url.searchParams.get('response_uri');
    const presentationDefinitionParam = url.searchParams.get('presentation_definition');

    if (!clientId || !nonce || !responseUri || !presentationDefinitionParam) {
      throw new Error('Invalid OID4VP request URI');
    }

    return {
      client_id: clientId,
      response_type: url.searchParams.get('response_type') ?? 'vp_token',
      nonce,
      response_uri: responseUri,
      presentation_definition: JSON.parse(presentationDefinitionParam) as OID4VPPresentationRequest['presentation_definition'],
    };
  }

  async selectCredentials(request: OID4VPPresentationRequest): Promise<StoredCredential[]> {
    const availableCredentials = await this.credentialStore.listCredentials();
    const selectedCredentials: StoredCredential[] = [];
    const selectedIds = new Set<string>();

    for (const descriptor of request.presentation_definition.input_descriptors) {
      const match = availableCredentials.find(
        (credential) =>
          !selectedIds.has(credential.id) &&
          matchesInputDescriptor(credential, descriptor),
      );

      if (match) {
        selectedIds.add(match.id);
        selectedCredentials.push(match);
      }
    }

    return selectedCredentials;
  }

  private buildPresentationSubmission(
    request: OID4VPPresentationRequest,
    credentialIds: string[],
  ): Record<string, unknown> {
    return {
      id: `submission-${request.nonce}`,
      definition_id: request.presentation_definition.id,
      descriptor_map: request.presentation_definition.input_descriptors
        .slice(0, credentialIds.length)
        .map((descriptor, index) => ({
          id: descriptor.id,
          format: 'jwt_vp_json',
          path: `$.verifiableCredential[${index}]`,
        })),
    };
  }

  private async isResponseUriReachable(responseUri: string): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await this.fetchImpl(responseUri, {
        method: 'HEAD',
        signal: controller.signal,
      });

      return response.ok || response.status === 401 || response.status === 403 || response.status === 405;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private async submitPresentation(
    request: OID4VPPresentationRequest,
    presentation: OfflinePresentation,
    selectedCredentials: StoredCredential[],
  ): Promise<{ submitted: boolean; statusCode?: number }> {
    if (!(await this.isResponseUriReachable(request.response_uri))) {
      return { submitted: false };
    }

    const jwtPayload = decodeJwt(presentation.vpJwt);
    const vp = jwtPayload.vp as Record<string, unknown> | undefined;

    const response = await this.fetchImpl(request.response_uri, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presentation_submission: this.buildPresentationSubmission(
          request,
          selectedCredentials.map((credential) => credential.id),
        ),
        vp_token: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          id: typeof jwtPayload.jti === 'string' ? jwtPayload.jti : crypto.randomUUID(),
          holder: presentation.holderDid,
          verifiableCredential: selectedCredentials.map(mapStoredCredentialToVpToken),
          ...(vp ? { disclosedPresentation: vp } : {}),
        },
        state: request.nonce,
      }),
    });

    return {
      submitted: response.ok,
      statusCode: response.status,
    };
  }

  async handleRequest(
    uriOrRequest: string | OID4VPPresentationRequest,
    options: {
      credentialIds?: string[];
      disclosedClaims?: string[];
    } = {},
  ): Promise<OID4VPHandledPresentation> {
    const request =
      typeof uriOrRequest === 'string' ? this.parseRequest(uriOrRequest) : uriOrRequest;
    const matchedCredentials = await this.selectCredentials(request);
    const selectedCredentials =
      options.credentialIds && options.credentialIds.length > 0
        ? matchedCredentials.filter((credential) => options.credentialIds?.includes(credential.id))
        : matchedCredentials;

    if (selectedCredentials.length === 0) {
      throw new Error('No credentials matched the OID4VP request');
    }

    const presentation = await this.presentationEngine.createPresentation({
      credentialIds: selectedCredentials.map((credential) => credential.id),
      verifierDid: request.client_id,
      nonce: request.nonce,
      disclosedClaims: options.disclosedClaims,
    });
    const submission = await this.submitPresentation(
      request,
      presentation,
      selectedCredentials,
    );

    return {
      request,
      presentation,
      matchedCredentials: selectedCredentials,
      submitted: submission.submitted,
      ...(submission.statusCode ? { statusCode: submission.statusCode } : {}),
    };
  }
}

export const oid4vpHandler = new OID4VPHandler();
