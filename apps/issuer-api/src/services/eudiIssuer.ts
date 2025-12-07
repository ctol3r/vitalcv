/**
 * B139A-EUDI-006: EUDI Wallet VC Issuance Service
 *
 * Issues EUDI Wallet-compatible Verifiable Credentials.
 * CRITICAL: EUDI VCs can ONLY be issued in the EU region.
 *
 * Compliance:
 * - eIDAS 2.0 / EUDI Framework
 * - Architecture Reference Framework (ARF) v1.4+
 * - GDPR Article 25 (data protection by design)
 */

import { Region } from '../../../../services/org/models/TenantRegion';
import {
  isEudiEligible,
  getEudiIssuanceRegion,
  getEudiCountryMetadata,
} from '../../../../services/compacts/euRegionMap';

/**
 * Get current cluster region from environment
 */
const CURRENT_REGION: Region = (process.env.CLUSTER_REGION as Region) || Region.US;

/**
 * EUDI Credential types supported
 */
export enum EudiCredentialType {
  PID = 'PersonIdentificationData', // Person Identification Data
  MDOC = 'mDL', // Mobile Driving License (ISO 18013-5)
  HEALTH_PROFESSIONAL = 'HealthProfessionalCredential',
  PRESCRIPTION = 'Prescription',
  // Healthcare-specific types
  MEDICAL_LICENSE = 'MedicalLicense',
  NURSING_LICENSE = 'NursingLicense',
  PHARMACY_LICENSE = 'PharmacyLicense',
}

/**
 * EUDI credential request
 */
export interface EudiCredentialRequest {
  credentialType: EudiCredentialType;
  subjectDid: string;
  countryCode: string; // ISO 3166-1 alpha-2
  claims: Record<string, any>;
  holderBindingKey?: string; // Public key for holder binding
  validityPeriod?: {
    notBefore?: Date;
    notAfter?: Date;
  };
}

/**
 * EUDI credential response
 */
export interface EudiCredentialResponse {
  credential: string; // JWT or SD-JWT format
  format: 'vc+sd-jwt' | 'jwt_vc_json';
  credentialType: EudiCredentialType;
  issuanceDate: Date;
  expirationDate?: Date;
  issuerDid: string;
}

/**
 * EUDI issuance error
 */
export class EudiIssuanceError extends Error {
  constructor(
    message: string,
    public code: string,
    public region?: Region,
    public countryCode?: string
  ) {
    super(message);
    this.name = 'EudiIssuanceError';
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      region: this.region,
      countryCode: this.countryCode,
    };
  }
}

/**
 * EUDI issuance audit log
 */
export interface EudiIssuanceAuditLog {
  timestamp: Date;
  credentialType: EudiCredentialType;
  countryCode: string;
  subjectDid: string;
  currentRegion: Region;
  allowed: boolean;
  reason: string;
  issuerDid?: string;
  credentialId?: string;
}

/**
 * In-memory audit log (in production, send to CloudWatch/SIEM)
 */
const auditLogs: EudiIssuanceAuditLog[] = [];

/**
 * Log EUDI issuance attempt
 */
function logIssuanceAttempt(
  request: EudiCredentialRequest,
  allowed: boolean,
  reason: string,
  credentialId?: string
): void {
  const log: EudiIssuanceAuditLog = {
    timestamp: new Date(),
    credentialType: request.credentialType,
    countryCode: request.countryCode,
    subjectDid: request.subjectDid,
    currentRegion: CURRENT_REGION,
    allowed,
    reason,
    credentialId,
  };

  auditLogs.push(log);

  if (!allowed) {
    console.error('[EUDI_ISSUER] Issuance denied:', JSON.stringify(log));
  } else {
    console.info('[EUDI_ISSUER] Credential issued:', JSON.stringify(log));
  }
}

/**
 * Validate region for EUDI issuance
 *
 * @throws EudiIssuanceError if current region is not EU
 */
export function validateEudiRegion(): void {
  if (CURRENT_REGION !== Region.EU) {
    const error = new EudiIssuanceError(
      `EUDI Wallet credentials can only be issued in EU region. Current region: ${CURRENT_REGION}`,
      'INVALID_REGION',
      CURRENT_REGION
    );
    throw error;
  }
}

/**
 * Validate country eligibility for EUDI
 *
 * @param countryCode ISO 3166-1 alpha-2 country code
 * @throws EudiIssuanceError if country is not EUDI-eligible
 */
export function validateEudiCountry(countryCode: string): void {
  if (!isEudiEligible(countryCode)) {
    const metadata = getEudiCountryMetadata(countryCode);
    throw new EudiIssuanceError(
      `Country ${countryCode} (${metadata.countryName}) is not eligible for EUDI Wallet credentials`,
      'COUNTRY_NOT_ELIGIBLE',
      undefined,
      countryCode
    );
  }
}

/**
 * Issue EUDI Wallet credential
 *
 * Main entry point for EUDI credential issuance.
 * Enforces region and country eligibility checks.
 *
 * @param request EUDI credential request
 * @returns EUDI credential response
 * @throws EudiIssuanceError if issuance is not allowed
 */
export async function issueEudiCredential(
  request: EudiCredentialRequest
): Promise<EudiCredentialResponse> {
  try {
    // 1. Validate current region is EU
    validateEudiRegion();

    // 2. Validate country eligibility
    validateEudiCountry(request.countryCode);

    // 3. Generate credential ID
    const credentialId = generateCredentialId();

    // 4. Build credential payload
    const credential = await buildEudiCredential(request, credentialId);

    // 5. Sign credential
    const signedCredential = await signEudiCredential(credential);

    // 6. Log successful issuance
    logIssuanceAttempt(
      request,
      true,
      'Credential issued successfully',
      credentialId
    );

    // 7. Return response
    return {
      credential: signedCredential,
      format: 'vc+sd-jwt', // EUDI ARF prefers SD-JWT
      credentialType: request.credentialType,
      issuanceDate: new Date(),
      expirationDate: request.validityPeriod?.notAfter,
      issuerDid: getEuIssuerDid(),
    };
  } catch (error) {
    // Log denied issuance
    if (error instanceof EudiIssuanceError) {
      logIssuanceAttempt(request, false, error.message);
    }
    throw error;
  }
}

/**
 * Generate credential ID
 */
function generateCredentialId(): string {
  return `urn:uuid:${crypto.randomUUID()}`;
}

/**
 * Get EU issuer DID
 * In production, this would be registered with EU trust registry
 */
function getEuIssuerDid(): string {
  return process.env.EU_ISSUER_DID || 'did:web:eu.issuer.vitalcv.com';
}

/**
 * Build EUDI credential payload
 */
async function buildEudiCredential(
  request: EudiCredentialRequest,
  credentialId: string
): Promise<any> {
  const now = new Date();
  const expirationDate = request.validityPeriod?.notAfter ||
                         new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000); // 1 year default

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://eu-digital-identity-wallet.github.io/eudi-doc-architecture-and-reference-framework/latest/contexts/eudi-v1.jsonld',
    ],
    id: credentialId,
    type: ['VerifiableCredential', request.credentialType],
    issuer: {
      id: getEuIssuerDid(),
      name: 'VitalCV EU Issuer',
      country: 'EU',
    },
    issuanceDate: now.toISOString(),
    expirationDate: expirationDate.toISOString(),
    credentialSubject: {
      id: request.subjectDid,
      country: request.countryCode,
      ...request.claims,
    },
    // EUDI-specific metadata
    credentialSchema: {
      id: `https://api.vitalcv.com/schemas/${request.credentialType}.json`,
      type: 'JsonSchema2023',
    },
    // Holder binding (if provided)
    ...(request.holderBindingKey && {
      credentialSubject: {
        ...request.claims,
        publicKey: request.holderBindingKey,
      },
    }),
  };
}

/**
 * Sign EUDI credential
 * In production, this would use HSM-backed signing
 */
async function signEudiCredential(credential: any): Promise<string> {
  // Placeholder: In production, use SD-JWT library with proper signing
  // For now, return JSON stringified (would be actual SD-JWT format)

  // This would be:
  // import { SignJWT } from 'jose';
  // const jwt = await new SignJWT(credential)
  //   .setProtectedHeader({ alg: 'ES256', typ: 'vc+sd-jwt' })
  //   .sign(privateKey);

  return JSON.stringify(credential);
}

/**
 * Batch issue EUDI credentials
 *
 * @param requests Array of credential requests
 * @returns Array of responses (successful) and errors (failed)
 */
export async function batchIssueEudiCredentials(
  requests: EudiCredentialRequest[]
): Promise<{
  successful: EudiCredentialResponse[];
  failed: Array<{ request: EudiCredentialRequest; error: EudiIssuanceError }>;
}> {
  const successful: EudiCredentialResponse[] = [];
  const failed: Array<{ request: EudiCredentialRequest; error: EudiIssuanceError }> = [];

  for (const request of requests) {
    try {
      const response = await issueEudiCredential(request);
      successful.push(response);
    } catch (error) {
      if (error instanceof EudiIssuanceError) {
        failed.push({ request, error });
      } else {
        failed.push({
          request,
          error: new EudiIssuanceError(
            error instanceof Error ? error.message : 'Unknown error',
            'UNKNOWN_ERROR'
          ),
        });
      }
    }
  }

  return { successful, failed };
}

/**
 * Get EUDI issuance audit logs
 */
export function getEudiAuditLogs(filters?: {
  allowed?: boolean;
  countryCode?: string;
  credentialType?: EudiCredentialType;
  startDate?: Date;
  endDate?: Date;
}): EudiIssuanceAuditLog[] {
  let filtered = [...auditLogs];

  if (filters) {
    if (filters.allowed !== undefined) {
      filtered = filtered.filter(log => log.allowed === filters.allowed);
    }
    if (filters.countryCode) {
      filtered = filtered.filter(log => log.countryCode === filters.countryCode);
    }
    if (filters.credentialType) {
      filtered = filtered.filter(log => log.credentialType === filters.credentialType);
    }
    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }
  }

  return filtered;
}

/**
 * Clear EUDI audit logs (for testing)
 */
export function clearEudiAuditLogs(): void {
  auditLogs.length = 0;
}

/**
 * Get EUDI issuance metrics
 */
export interface EudiIssuanceMetrics {
  totalRequests: number;
  successful: number;
  failed: number;
  failureReasons: Record<string, number>;
  byCountry: Record<string, { successful: number; failed: number }>;
  byCredentialType: Record<EudiCredentialType, { successful: number; failed: number }>;
}

export function getEudiIssuanceMetrics(): EudiIssuanceMetrics {
  const metrics: EudiIssuanceMetrics = {
    totalRequests: auditLogs.length,
    successful: 0,
    failed: 0,
    failureReasons: {},
    byCountry: {},
    byCredentialType: {} as any,
  };

  for (const log of auditLogs) {
    if (log.allowed) {
      metrics.successful++;
    } else {
      metrics.failed++;
      metrics.failureReasons[log.reason] = (metrics.failureReasons[log.reason] || 0) + 1;
    }

    // By country
    if (!metrics.byCountry[log.countryCode]) {
      metrics.byCountry[log.countryCode] = { successful: 0, failed: 0 };
    }
    if (log.allowed) {
      metrics.byCountry[log.countryCode].successful++;
    } else {
      metrics.byCountry[log.countryCode].failed++;
    }

    // By credential type
    if (!metrics.byCredentialType[log.credentialType]) {
      metrics.byCredentialType[log.credentialType] = { successful: 0, failed: 0 };
    }
    if (log.allowed) {
      metrics.byCredentialType[log.credentialType].successful++;
    } else {
      metrics.byCredentialType[log.credentialType].failed++;
    }
  }

  return metrics;
}

/**
 * Check if EUDI issuance is available in current region
 */
export function isEudiIssuanceAvailable(): boolean {
  return CURRENT_REGION === Region.EU;
}

/**
 * Get current region
 */
export function getCurrentRegion(): Region {
  return CURRENT_REGION;
}

/**
 * Example usage documentation
 */
export const USAGE_EXAMPLES = `
# EUDI Issuer Service Usage Examples

## Issue a medical license credential (EU region)

\`\`\`typescript
import { issueEudiCredential, EudiCredentialType } from './eudiIssuer';

// This will succeed if current region is EU
const response = await issueEudiCredential({
  credentialType: EudiCredentialType.MEDICAL_LICENSE,
  subjectDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  countryCode: 'DE', // Germany
  claims: {
    licenseNumber: 'DE-12345',
    specialty: 'Cardiology',
    issuingAuthority: 'German Medical Association',
    issueDate: '2020-01-15',
  },
});

console.log('Credential issued:', response.credential);
\`\`\`

## Attempt to issue from wrong region (will fail)

\`\`\`typescript
// If CLUSTER_REGION=us, this will throw EudiIssuanceError
try {
  await issueEudiCredential({
    credentialType: EudiCredentialType.MEDICAL_LICENSE,
    subjectDid: 'did:key:...',
    countryCode: 'DE',
    claims: { ... },
  });
} catch (error) {
  if (error instanceof EudiIssuanceError) {
    console.error('EUDI issuance denied:', error.code, error.message);
    // Output: INVALID_REGION - EUDI Wallet credentials can only be issued in EU region
  }
}
\`\`\`

## Attempt to issue for non-EEA country (will fail)

\`\`\`typescript
try {
  await issueEudiCredential({
    credentialType: EudiCredentialType.MEDICAL_LICENSE,
    subjectDid: 'did:key:...',
    countryCode: 'US', // Not EUDI-eligible
    claims: { ... },
  });
} catch (error) {
  if (error instanceof EudiIssuanceError) {
    console.error('Country not eligible:', error.code, error.countryCode);
    // Output: COUNTRY_NOT_ELIGIBLE - US
  }
}
\`\`\`

## Batch issuance

\`\`\`typescript
import { batchIssueEudiCredentials } from './eudiIssuer';

const requests = [
  { credentialType: EudiCredentialType.MEDICAL_LICENSE, subjectDid: 'did:1', countryCode: 'DE', claims: {...} },
  { credentialType: EudiCredentialType.NURSING_LICENSE, subjectDid: 'did:2', countryCode: 'FR', claims: {...} },
  { credentialType: EudiCredentialType.MEDICAL_LICENSE, subjectDid: 'did:3', countryCode: 'US', claims: {...} }, // Will fail
];

const { successful, failed } = await batchIssueEudiCredentials(requests);

console.log(\`Issued: \${successful.length}, Failed: \${failed.length}\`);
\`\`\`

## Check if EUDI issuance is available

\`\`\`typescript
import { isEudiIssuanceAvailable, getCurrentRegion } from './eudiIssuer';

if (isEudiIssuanceAvailable()) {
  console.log('EUDI issuance available in region:', getCurrentRegion());
} else {
  console.log('EUDI issuance not available. Current region:', getCurrentRegion());
}
\`\`\`
`;

