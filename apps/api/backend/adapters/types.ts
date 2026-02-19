// ============================================================
// Wave 1B — Adapter Contract & Normalized Payload
// ============================================================

import type {
  ProviderType,
  CredentialType,
  CredentialStatus,
  SourceType,
  RetrievalMethod,
  CompactName,
} from "../types/psv";

// ── Normalized Credential Payload ─────────────────────────────

export interface NormalizedCredentialPayload {
  provider: {
    npi: string;
    taxonomyCode: string;
    providerType: ProviderType;
    fullName: string;
    dateOfBirth?: string;
    stateOfPractice: string;
  };
  credential: {
    credentialType: CredentialType;
    credentialIdentifier: string;
    issuingStateOrBody: string;
    status: CredentialStatus;
    issueDate?: string;
    expirationDate?: string;
    compactStatus?: {
      participating: boolean;
      compactName: CompactName;
    };
  };
  source: {
    sourceName: string;
    sourceType: SourceType;
    sourceEndpoint?: string;
    sourceRecognition: "PrimarySource" | "ContractedAgent";
  };
  retrieval: {
    retrievedAtUtc: string;
    retrievalMethod: RetrievalMethod;
    rawPayload: unknown;
  };
}

// ── PSV Adapter Contract ──────────────────────────────────────

export interface PsvAdapter {
  adapterName: string;
  supportedProviderTypes: ProviderType[];
  supportedCredentialTypes: CredentialType[];
  verify(params: {
    npi: string;
    state?: string;
    licenseNumber?: string;
  }): Promise<NormalizedCredentialPayload>;
}
