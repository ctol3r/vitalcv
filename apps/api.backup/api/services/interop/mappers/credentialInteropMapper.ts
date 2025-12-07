/**
 * B226A-INT-004: CredentialInteropMapper
 *
 * Maps external credential schemas (e.g. OpenBadge, HL7, DSCSA) to VitalCV internal format.
 * Validates required fields. Transforms both directions.
 */

import { getServiceLogger } from '../../logging/serviceLogger';

const log = getServiceLogger('interop/mappers/credentialInteropMapper');

interface VitalCVCredential {
  id: string;
  type: string;
  issuer: {
    id: string;
    name: string;
    did?: string;
  };
  holder: {
    id: string;
    did?: string;
  };
  issuedAt: Date;
  expiresAt?: Date;
  credentialSubject: Record<string, any>;
  proof?: {
    type: string;
    proofValue: string;
  };
  metadata?: Record<string, any>;
}

interface OpenBadgeCredential {
  '@context': string | string[];
  type: string | string[];
  id: string;
  name?: string;
  description?: string;
  image?: string;
  issuer: {
    type: string;
    id: string;
    name?: string;
  };
  recipient: {
    type: string;
    identity: string;
    hashed?: boolean;
    salt?: string;
  };
  badge?: {
    id: string;
    type: string;
    name: string;
    description?: string;
    image?: string;
    criteria?: string;
  };
  issuedOn: string;
  expires?: string;
  evidence?: any[];
  verification?: {
    type: string;
    verificationProperty?: string;
  };
}

interface HL7Credential {
  resourceType: string;
  id: string;
  status: string;
  type: {
    coding: Array<{
      system?: string;
      code: string;
      display?: string;
    }>;
  };
  subject?: {
    reference?: string;
    identifier?: {
      system?: string;
      value: string;
    };
  };
  issuer?: {
    reference?: string;
    identifier?: {
      system?: string;
      value: string;
    };
  };
  issued?: string;
  expirationDate?: string;
  credentialSubject?: Record<string, any>;
}

interface DSCSACredential {
  credentialType: string;
  credentialId: string;
  issuerId: string;
  holderId: string;
  issuedDate: string;
  expirationDate?: string;
  productIdentifier?: string;
  transactionIdentifier?: string;
  metadata?: Record<string, any>;
}

class CredentialInteropMapper {
  /**
   * Map OpenBadge credential to VitalCV format
   */
  mapFromOpenBadge(badge: OpenBadgeCredential): VitalCVCredential {
    log.debug('Mapping OpenBadge credential', { id: badge.id });

    const issuedAt = badge.issuedOn ? new Date(badge.issuedOn) : new Date();
    const expiresAt = badge.expires ? new Date(badge.expires) : undefined;

    return {
      id: badge.id,
      type: Array.isArray(badge.type) ? badge.type.find(t => t !== 'VerifiableCredential') || 'Credential' : 'Credential',
      issuer: {
        id: badge.issuer.id,
        name: badge.issuer.name || 'Unknown Issuer',
      },
      holder: {
        id: typeof badge.recipient.identity === 'string' ? badge.recipient.identity : '',
      },
      issuedAt,
      expiresAt,
      credentialSubject: {
        badge: badge.badge,
        name: badge.name,
        description: badge.description,
        image: badge.image,
        evidence: badge.evidence,
      },
      metadata: {
        sourceFormat: 'OpenBadge',
        verification: badge.verification,
      },
    };
  }

  /**
   * Map VitalCV credential to OpenBadge format
   */
  mapToOpenBadge(credential: VitalCVCredential): OpenBadgeCredential {
    log.debug('Mapping VitalCV credential to OpenBadge', { id: credential.id });

    return {
      '@context': 'https://w3id.org/openbadges/v2',
      type: ['VerifiableCredential', credential.type],
      id: credential.id,
      name: credential.credentialSubject.name || credential.type,
      description: credential.credentialSubject.description,
      image: credential.credentialSubject.image,
      issuer: {
        type: 'Profile',
        id: credential.issuer.id,
        name: credential.issuer.name,
      },
      recipient: {
        type: 'email',
        identity: credential.holder.id,
        hashed: false,
      },
      badge: credential.credentialSubject.badge,
      issuedOn: credential.issuedAt.toISOString(),
      expires: credential.expiresAt?.toISOString(),
      evidence: credential.credentialSubject.evidence,
      verification: credential.metadata?.verification,
    };
  }

  /**
   * Map HL7 credential to VitalCV format
   */
  mapFromHL7(hl7: HL7Credential): VitalCVCredential {
    log.debug('Mapping HL7 credential', { id: hl7.id });

    const issuedAt = hl7.issued ? new Date(hl7.issued) : new Date();
    const expiresAt = hl7.expirationDate ? new Date(hl7.expirationDate) : undefined;

    const credentialType = hl7.type?.coding?.[0]?.code || 'Credential';
    const subjectId = hl7.subject?.identifier?.value || hl7.subject?.reference || '';
    const issuerId = hl7.issuer?.identifier?.value || hl7.issuer?.reference || '';

    return {
      id: hl7.id,
      type: credentialType,
      issuer: {
        id: issuerId,
        name: hl7.issuer?.identifier?.value || 'Unknown Issuer',
      },
      holder: {
        id: subjectId,
      },
      issuedAt,
      expiresAt,
      credentialSubject: {
        status: hl7.status,
        ...hl7.credentialSubject,
      },
      metadata: {
        sourceFormat: 'HL7',
        resourceType: hl7.resourceType,
      },
    };
  }

  /**
   * Map VitalCV credential to HL7 format
   */
  mapToHL7(credential: VitalCVCredential): HL7Credential {
    log.debug('Mapping VitalCV credential to HL7', { id: credential.id });

    return {
      resourceType: 'Credential',
      id: credential.id,
      status: credential.credentialSubject.status || 'active',
      type: {
        coding: [
          {
            system: 'http://hl7.org/fhir/credential-type',
            code: credential.type,
            display: credential.type,
          },
        ],
      },
      subject: {
        identifier: {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: credential.holder.id,
        },
      },
      issuer: {
        identifier: {
          system: 'http://hl7.org/fhir/sid/us-npi',
          value: credential.issuer.id,
        },
      },
      issued: credential.issuedAt.toISOString(),
      expirationDate: credential.expiresAt?.toISOString(),
      credentialSubject: credential.credentialSubject,
    };
  }

  /**
   * Map DSCSA credential to VitalCV format
   */
  mapFromDSCSA(dscsa: DSCSACredential): VitalCVCredential {
    log.debug('Mapping DSCSA credential', { id: dscsa.credentialId });

    const issuedAt = dscsa.issuedDate ? new Date(dscsa.issuedDate) : new Date();
    const expiresAt = dscsa.expirationDate ? new Date(dscsa.expirationDate) : undefined;

    return {
      id: dscsa.credentialId,
      type: dscsa.credentialType,
      issuer: {
        id: dscsa.issuerId,
        name: 'DSCSA Issuer',
      },
      holder: {
        id: dscsa.holderId,
      },
      issuedAt,
      expiresAt,
      credentialSubject: {
        productIdentifier: dscsa.productIdentifier,
        transactionIdentifier: dscsa.transactionIdentifier,
        ...dscsa.metadata,
      },
      metadata: {
        sourceFormat: 'DSCSA',
      },
    };
  }

  /**
   * Map VitalCV credential to DSCSA format
   */
  mapToDSCSA(credential: VitalCVCredential): DSCSACredential {
    log.debug('Mapping VitalCV credential to DSCSA', { id: credential.id });

    return {
      credentialType: credential.type,
      credentialId: credential.id,
      issuerId: credential.issuer.id,
      holderId: credential.holder.id,
      issuedDate: credential.issuedAt.toISOString(),
      expirationDate: credential.expiresAt?.toISOString(),
      productIdentifier: credential.credentialSubject.productIdentifier,
      transactionIdentifier: credential.credentialSubject.transactionIdentifier,
      metadata: credential.metadata,
    };
  }

  /**
   * Validate required fields for VitalCV credential
   */
  validateVitalCVCredential(credential: VitalCVCredential): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!credential.id) {
      errors.push('Missing required field: id');
    }

    if (!credential.type) {
      errors.push('Missing required field: type');
    }

    if (!credential.issuer || !credential.issuer.id) {
      errors.push('Missing required field: issuer.id');
    }

    if (!credential.holder || !credential.holder.id) {
      errors.push('Missing required field: holder.id');
    }

    if (!credential.issuedAt) {
      errors.push('Missing required field: issuedAt');
    }

    if (credential.expiresAt && credential.expiresAt < credential.issuedAt) {
      errors.push('expiresAt must be after issuedAt');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Auto-detect credential format and map to VitalCV
   */
  mapToVitalCV(credential: any): VitalCVCredential {
    // Detect format
    if (credential['@context'] || credential.type === 'VerifiableCredential') {
      return this.mapFromOpenBadge(credential as OpenBadgeCredential);
    }

    if (credential.resourceType === 'Credential' || credential.resourceType === 'FHIR') {
      return this.mapFromHL7(credential as HL7Credential);
    }

    if (credential.credentialType && credential.credentialId) {
      return this.mapFromDSCSA(credential as DSCSACredential);
    }

    // If already in VitalCV format, validate and return
    const validation = this.validateVitalCVCredential(credential as VitalCVCredential);
    if (validation.valid) {
      return credential as VitalCVCredential;
    }

    throw new Error(`Unknown credential format: ${JSON.stringify(validation.errors)}`);
  }
}

export const credentialInteropMapper = new CredentialInteropMapper();
export default credentialInteropMapper;

