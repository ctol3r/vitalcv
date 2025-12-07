import { NormalizedProvider } from '../../international/providerAdapter';

export interface CredentialTemplate {
  type: string[];
  context: string[];
  credentialSubject: Record<string, any>;
  evidence?: any[];
}

export class GlobalCredentialGenerator {

  static generateUS_HIPAA(provider: NormalizedProvider): CredentialTemplate {
    return {
      context: [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/v2',
        'https://w3id.org/hipaa/v1'
      ],
      type: ['VerifiableCredential', 'HealthcareProviderCredential', 'HipaaCompliantCredential'],
      credentialSubject: {
        id: `did:npi:${provider.id}`,
        npi: provider.id,
        name: provider.name,
        type: provider.type,
        specialties: provider.specialties,
        active: provider.active,
        jurisdiction: {
          country: 'US',
          state: provider.address?.state
        }
      },
      evidence: [{
        type: 'NppesVerification',
        verifier: 'VitalCV Global Adapter',
        timestamp: new Date().toISOString()
      }]
    };
  }

  static generateEU_eIDAS(provider: NormalizedProvider): CredentialTemplate {
    return {
      context: [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/security/v2',
        'https://w3id.org/eidas/v1'
      ],
      type: ['VerifiableCredential', 'EidasQualifiedCredential'],
      credentialSubject: {
        id: `did:eidas:${provider.id}`, // Conceptual ID
        legalName: provider.name,
        professionalId: provider.id,
        assuranceLevel: 'substantial',
        jurisdiction: 'EU'
      }
    };
  }

  static generateCanada_CPSO(provider: NormalizedProvider): CredentialTemplate {
    return {
      context: [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/cpso/v1'
      ],
      type: ['VerifiableCredential', 'MedicalLicenseCredential'],
      credentialSubject: {
        id: `did:cpso:${provider.id}`,
        cpsoNumber: provider.id,
        name: provider.name,
        status: provider.active ? 'Active' : 'Inactive',
        specialties: provider.specialties,
        jurisdiction: {
          country: 'CA',
          province: 'ON' // Assuming CPSO implies Ontario
        }
      }
    };
  }

  static generateIndia_NMC(provider: NormalizedProvider): CredentialTemplate {
    return {
      context: [
        'https://www.w3.org/2018/credentials/v1',
        'https://w3id.org/nmc/v1'
      ],
      type: ['VerifiableCredential', 'MedicalRegistrationCredential'],
      credentialSubject: {
        id: `did:nmc:${provider.id}`,
        registrationNumber: provider.id,
        name: provider.name,
        council: 'National Medical Commission',
        jurisdiction: {
          country: 'IN'
        }
      }
    };
  }
}














