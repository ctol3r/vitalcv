// ============================================================
// Wave 1A — Universal PSV Artifact Type System
// ============================================================

// ── Enum Types ──────────────────────────────────────────────

export type ProviderType =
  | "NP"
  | "RN"
  | "MD"
  | "DO"
  | "PA"
  | "CRNA"
  | "Psychologist"
  | "Dentist"
  | "PT"
  | "OT"
  | "Pharmacist"
  | "Other";

export type CredentialType =
  | "License"
  | "BoardCertification"
  | "DEA"
  | "Registration"
  | "CompactPrivilege"
  | "Other";

export type CredentialStatus =
  | "Active"
  | "Expired"
  | "Restricted"
  | "Pending"
  | "Suspended"
  | "Unknown";

export type SourceType =
  | "API"
  | "DirectDatabase"
  | "OfficialRegistry"
  | "ManualPrimarySource"
  | "BatchFile";

export type RetrievalMethod =
  | "API"
  | "ManualEntry"
  | "BatchFile"
  | "DirectQuery";

export type WindowStatus =
  | "Compliant"
  | "Approaching"
  | "Out_of_Window";

export type CompactName =
  | "NLC"
  | "IMLC"
  | "PSYPACT"
  | "None"
  | null;

// ── Interfaces ──────────────────────────────────────────────

export interface Provider {
  npi: string;
  taxonomyCode: string;
  providerType: ProviderType;
  fullName: string;
  dateOfBirth?: string;
  stateOfPractice: string;
}

export interface Credential {
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
}

export interface PrimarySource {
  sourceName: string;
  sourceType: SourceType;
  sourceEndpoint?: string;
  sourceRecognition: "PrimarySource" | "ContractedAgent";
}

export interface RetrievalAgent {
  systemId: string;
  environment: "development" | "staging" | "production";
  agentVersion: string;
}

export interface RetrievalEvent {
  retrievedAtUtc: string;
  retrievalMethod: RetrievalMethod;
  retrievedBy: RetrievalAgent;
  rawPayloadStorageRef: string;
  rawPayloadHashSha256: string;
}

export interface EvidenceIntegrity {
  hashAlgorithm: "SHA-256";
  artifactHash: string;
  signatureAlgorithm: "ES256";
  artifactSignature: string;
  signatureIssuedAt: string;
}

export interface DecisionWindow {
  daysSinceRetrieval: number;
  ncqaWindowDays: number;
  withinNcqaWindow: boolean;
  nextExpirationWarningDays: number;
  windowStatus: WindowStatus;
}

export interface DeltaLogEntry {
  changeId: string;
  previousStatus: CredentialStatus;
  newStatus: CredentialStatus;
  detectedAt: string;
  deltaPayloadHash: string;
}

export interface Monitoring {
  monitoringEnabled: boolean;
  lastCheckedAt: string;
  changeDetected: boolean;
  deltaLog: DeltaLogEntry[];
}

export interface EnrollmentAttestation {
  statement: string;
  attestedAt: string;
}

export interface EnrollmentContext {
  cmsRelevant: boolean;
  pecosAttachmentReady: boolean;
  exportFormats: ("PDF" | "JSON" | "VC")[];
  attestation: EnrollmentAttestation;
}

export interface PsvArtifact {
  artifactVersion: "1.0";
  artifactId: string;
  provider: Provider;
  credential: Credential;
  primarySource: PrimarySource;
  retrievalEvent: RetrievalEvent;
  evidenceIntegrity: EvidenceIntegrity;
  decisionWindow: DecisionWindow;
  monitoring: Monitoring;
  enrollmentContext: EnrollmentContext;
}
