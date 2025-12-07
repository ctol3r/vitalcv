import { getServiceLogger } from '../logging/serviceLogger';
const log = getServiceLogger('psv/registry');
/**
 * B119A-NCQA-006: API Primary-Source verification registry
 * B121A-PSV-005: NCQA API Source Registry integration (FCVS, NPDB, Nursys, NCCPA)
 *
 * NCQA-compliant registry for tracking primary source verification endpoints.
 * Generates CR1-CR5 audit evidence for NCQA credentialing requirements.
 *
 * CR1: Primary source verification of credentials
 * CR2: Verification of licensure
 * CR3: Verification of education
 * CR4: Verification of board certification
 * CR5: Verification of work history
 *
 * B121A-PSV-005: Endpoint mapping correct; audit entries log timestamp/source
 */

export type VerificationType = 'CR1' | 'CR2' | 'CR3' | 'CR4' | 'CR5';

export interface PrimarySourceEndpoint {
  id: string;
  name: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT';
  authType: 'API_KEY' | 'OAUTH2' | 'BASIC' | 'MTLS' | 'DPOP' | 'NONE';
  authConfig?: {
    apiKey?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
    certificate?: string;
  };
  verificationTypes: VerificationType[];
  description: string;
  provider: string; // e.g., "NPPES", "FSMB", "ABMS", "NPDB"
  active: boolean;
  lastVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationRequest {
  id: string;
  endpointId: string;
  verificationType: VerificationType;
  subjectId: string; // NPI, license number, etc.
  requestPayload: Record<string, unknown>;
  responsePayload: Record<string, unknown> | null;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  evidenceHash: string | null; // SHA256 hash of evidence
  timestamp: Date;
  durationMs: number | null;
}

export interface AuditEvidence {
  crType: VerificationType;
  endpointId: string;
  endpointName: string;
  subjectId: string;
  verificationId: string;
  timestamp: Date;
  evidenceHash: string;
  evidenceData: Record<string, unknown>;
  reviewerSignOff: {
    reviewerId: string;
    reviewerName: string;
    signedAt: Date;
    signature: string; // Digital signature or approval token
  } | null;
}

/**
 * Primary Source Verification Registry
 * B119A-NCQA-006: Tracks all PSV endpoints and generates CR1-CR5 audit evidence
 */
export class PSVRegistry {
  private endpoints: Map<string, PrimarySourceEndpoint> = new Map();
  private verifications: Map<string, VerificationRequest> = new Map();
  private auditEvidence: AuditEvidence[] = [];

  /**
   * Register a primary source verification endpoint
   */
  registerEndpoint(endpoint: Omit<PrimarySourceEndpoint, 'id' | 'createdAt' | 'updatedAt' | 'lastVerified'>): PrimarySourceEndpoint {
    const id = `psv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const fullEndpoint: PrimarySourceEndpoint = {
      ...endpoint,
      id,
      createdAt: now,
      updatedAt: now,
      lastVerified: null,
    };

    this.endpoints.set(id, fullEndpoint);
    return fullEndpoint;
  }

  /**
   * Get endpoint by ID
   */
  getEndpoint(endpointId: string): PrimarySourceEndpoint | null {
    return this.endpoints.get(endpointId) || null;
  }

  /**
   * List all endpoints
   */
  listEndpoints(filter?: {
    verificationType?: VerificationType;
    provider?: string;
    active?: boolean;
  }): PrimarySourceEndpoint[] {
    let endpoints = Array.from(this.endpoints.values());

    if (filter?.verificationType) {
      endpoints = endpoints.filter(e => e.verificationTypes.includes(filter.verificationType!));
    }

    if (filter?.provider) {
      endpoints = endpoints.filter(e => e.provider === filter.provider);
    }

    if (filter?.active !== undefined) {
      endpoints = endpoints.filter(e => e.active === filter.active);
    }

    return endpoints;
  }

  /**
   * Record a verification request
   * B119A-NCQA-006: Generates audit evidence for CR1-CR5
   * B121A-PSV-005: Audit entries log timestamp/source
   */
  recordVerification(
    endpointId: string,
    verificationType: VerificationType,
    subjectId: string,
    requestPayload: Record<string, unknown>,
    responsePayload: Record<string, unknown> | null,
    status: 'pending' | 'success' | 'failed' | 'timeout',
    durationMs: number | null
  ): VerificationRequest {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) {
      throw new Error(`Endpoint ${endpointId} not found`);
    }

    // B121A-PSV-005: Record timestamp and source in audit entry
    const timestamp = new Date();
    const source = endpoint.provider; // FCVS, NPDB, Nursys, NCCPA, etc.

    // Calculate evidence hash
    const evidenceData = {
      endpointId,
      verificationType,
      subjectId,
      requestPayload,
      responsePayload,
      timestamp: timestamp.toISOString(),
      source, // B121A-PSV-005: Include source in evidence hash
    };
    const evidenceHash = this.computeEvidenceHash(evidenceData);

    const verification: VerificationRequest = {
      id: `verify-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      endpointId,
      verificationType,
      subjectId,
      requestPayload,
      responsePayload,
      status,
      evidenceHash,
      timestamp,
      durationMs,
    };

    this.verifications.set(verification.id, verification);

    // Generate audit evidence if verification was successful
    if (status === 'success' && responsePayload) {
      this.generateAuditEvidence(verification, endpoint);
    }

    // Update endpoint last verified timestamp
    endpoint.lastVerified = timestamp;
    endpoint.updatedAt = timestamp;
    this.endpoints.set(endpointId, endpoint);

    // B121A-PSV-005: Log audit entry with timestamp and source
    log.info('[PSV Audit]', {
      verificationId: verification.id,
      endpointId,
      source,
      verificationType,
      subjectId,
      timestamp: timestamp.toISOString(),
      status,
      evidenceHash,
    });

    return verification;
  }

  /**
   * Generate audit evidence for NCQA compliance
   * B119A-NCQA-006: Creates CR1-CR5 audit evidence records
   * B121A-PSV-005: Audit entries include timestamp and source
   */
  private generateAuditEvidence(
    verification: VerificationRequest,
    endpoint: PrimarySourceEndpoint
  ): AuditEvidence {
    const evidence: AuditEvidence = {
      crType: verification.verificationType,
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      subjectId: verification.subjectId,
      verificationId: verification.id,
      timestamp: verification.timestamp, // B121A-PSV-005: Timestamp included
      evidenceHash: verification.evidenceHash!,
      evidenceData: {
        request: verification.requestPayload,
        response: verification.responsePayload,
        endpoint: {
          name: endpoint.name,
          url: endpoint.endpoint,
          authType: endpoint.authType,
          provider: endpoint.provider, // B121A-PSV-005: Source (FCVS, NPDB, Nursys, NCCPA) included
        },
        timestamp: verification.timestamp.toISOString(), // B121A-PSV-005: Explicit timestamp
        source: endpoint.provider, // B121A-PSV-005: Source explicitly logged
      },
      reviewerSignOff: null,
    };

    this.auditEvidence.push(evidence);
    return evidence;
  }

  /**
   * Add reviewer sign-off to audit evidence
   */
  signOffEvidence(
    verificationId: string,
    reviewerId: string,
    reviewerName: string,
    signature: string
  ): AuditEvidence | null {
    const evidence = this.auditEvidence.find(e => e.verificationId === verificationId);
    if (!evidence) {
      return null;
    }

    evidence.reviewerSignOff = {
      reviewerId,
      reviewerName,
      signedAt: new Date(),
      signature,
    };

    return evidence;
  }

  /**
   * Get audit evidence by CR type
   */
  getAuditEvidence(crType?: VerificationType): AuditEvidence[] {
    if (crType) {
      return this.auditEvidence.filter(e => e.crType === crType);
    }
    return [...this.auditEvidence];
  }

  /**
   * Get verification history
   */
  getVerificationHistory(filter?: {
    endpointId?: string;
    verificationType?: VerificationType;
    subjectId?: string;
    status?: VerificationRequest['status'];
  }): VerificationRequest[] {
    let verifications = Array.from(this.verifications.values());

    if (filter?.endpointId) {
      verifications = verifications.filter(v => v.endpointId === filter.endpointId);
    }

    if (filter?.verificationType) {
      verifications = verifications.filter(v => v.verificationType === filter.verificationType);
    }

    if (filter?.subjectId) {
      verifications = verifications.filter(v => v.subjectId === filter.subjectId);
    }

    if (filter?.status) {
      verifications = verifications.filter(v => v.status === filter.status);
    }

    return verifications.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Compute SHA256 hash of evidence data
   */
  private computeEvidenceHash(data: Record<string, unknown>): string {
    const crypto = require('crypto');
    const json = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalEndpoints: number;
    activeEndpoints: number;
    totalVerifications: number;
    byCRType: Record<VerificationType, number>;
    byStatus: Record<VerificationRequest['status'], number>;
    evidenceCount: number;
    signedOffCount: number;
  } {
    const endpoints = Array.from(this.endpoints.values());
    const verifications = Array.from(this.verifications.values());

    const byCRType: Record<VerificationType, number> = {
      CR1: 0,
      CR2: 0,
      CR3: 0,
      CR4: 0,
      CR5: 0,
    };

    const byStatus: Record<VerificationRequest['status'], number> = {
      pending: 0,
      success: 0,
      failed: 0,
      timeout: 0,
    };

    for (const verification of verifications) {
      byCRType[verification.verificationType]++;
      byStatus[verification.status]++;
    }

    return {
      totalEndpoints: endpoints.length,
      activeEndpoints: endpoints.filter(e => e.active).length,
      totalVerifications: verifications.length,
      byCRType,
      byStatus,
      evidenceCount: this.auditEvidence.length,
      signedOffCount: this.auditEvidence.filter(e => e.reviewerSignOff !== null).length,
    };
  }
}

// Singleton instance
let psvRegistry: PSVRegistry | null = null;

export function getPSVRegistry(): PSVRegistry {
  if (!psvRegistry) {
    psvRegistry = new PSVRegistry();
    // B121A-PSV-005: Initialize NCQA API Source Registry endpoints (FCVS, NPDB, Nursys, NCCPA)
    initializeNCQAEndpoints(psvRegistry);
  }
  return psvRegistry;
}

/**
 * B121A-PSV-005: Initialize NCQA API Source Registry endpoints
 * Registers FCVS, NPDB, Nursys, NCCPA endpoints with correct mapping
 */
function initializeNCQAEndpoints(registry: PSVRegistry): void {
  // FCVS (Federation Credentials Verification Service)
  registry.registerEndpoint({
    name: 'FCVS - Federation Credentials Verification Service',
    endpoint: process.env.FCVS_ENDPOINT || 'https://api.fcvs.org/v1/verify',
    method: 'POST',
    authType: 'OAUTH2',
    authConfig: {
      clientId: process.env.FCVS_CLIENT_ID,
      clientSecret: process.env.FCVS_CLIENT_SECRET,
      tokenUrl: process.env.FCVS_TOKEN_URL || 'https://api.fcvs.org/oauth/token',
    },
    verificationTypes: ['CR1', 'CR2', 'CR3'],
    description: 'FCVS provides primary source verification for medical credentials, licenses, and education',
    provider: 'FCVS',
    active: true,
  });

  // NPDB (National Practitioner Data Bank)
  registry.registerEndpoint({
    name: 'NPDB - National Practitioner Data Bank',
    endpoint: process.env.NPDB_ENDPOINT || 'https://api.npdb.hrsa.gov/v1/query',
    method: 'POST',
    authType: 'OAUTH2',
    authConfig: {
      clientId: process.env.NPDB_CLIENT_ID,
      clientSecret: process.env.NPDB_CLIENT_SECRET,
      tokenUrl: process.env.NPDB_TOKEN_URL || 'https://api.npdb.hrsa.gov/oauth/token',
    },
    verificationTypes: ['CR5'],
    description: 'NPDB provides queries for malpractice payments and disciplinary actions',
    provider: 'NPDB',
    active: true,
  });

  // Nursys (Nurse License Verification)
  registry.registerEndpoint({
    name: 'Nursys - Nurse License Verification',
    endpoint: process.env.NURSYS_ENDPOINT || 'https://api.nursys.com/v1/verify',
    method: 'POST',
    authType: 'API_KEY',
    authConfig: {
      apiKey: process.env.NURSYS_API_KEY,
    },
    verificationTypes: ['CR2', 'CR3'],
    description: 'Nursys provides primary source verification for nursing licenses',
    provider: 'Nursys',
    active: true,
  });

  // NCCPA (National Commission on Certification of Physician Assistants)
  registry.registerEndpoint({
    name: 'NCCPA - Physician Assistant Certification',
    endpoint: process.env.NCCPA_ENDPOINT || 'https://api.nccpa.net/v1/verify',
    method: 'POST',
    authType: 'API_KEY',
    authConfig: {
      apiKey: process.env.NCCPA_API_KEY,
    },
    verificationTypes: ['CR1', 'CR4'],
    description: 'NCCPA provides primary source verification for physician assistant certification',
    provider: 'NCCPA',
    active: true,
  });
}
