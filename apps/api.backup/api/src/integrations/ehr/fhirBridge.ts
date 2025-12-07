import { log } from '../../lib/logging';

export interface FhirResource {
  resourceType: string;
  id?: string;
  [key: string]: any;
}

export interface Practitioner extends FhirResource {
  resourceType: 'Practitioner';
  name: Array<{ family: string; given: string[] }>;
}

export interface Organization extends FhirResource {
  resourceType: 'Organization';
  name: string;
}

export interface FhirBridgeConfig {
  baseUrl: string;
  version: 'R4' | 'R6';
  apiKey?: string;
}

export class FhirBridge {
  constructor(private config: FhirBridgeConfig) {}

  async getPractitioner(id: string): Promise<Practitioner> {
    log.info(`Fetching Practitioner ${id} from EHR (${this.config.version})`);
    return {
      resourceType: 'Practitioner',
      id,
      name: [{ family: 'Doe', given: ['John'] }]
    };
  }

  async getOrganization(id: string): Promise<Organization> {
    log.info(`Fetching Organization ${id} from EHR`);
    return {
      resourceType: 'Organization',
      id,
      name: 'General Hospital'
    };
  }

  async createCredential(practitionerId: string, credentialData: any): Promise<void> {
    log.info(`Creating Credential for ${practitionerId}`, credentialData);
    // Stub
  }

  async registerSubscriptionHook(resourceType: string, callbackUrl: string): Promise<void> {
    log.info(`Registering subscription hook for ${resourceType} to ${callbackUrl}`);
    // Stub
  }
}


