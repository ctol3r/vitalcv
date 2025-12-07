import { log } from '../../lib/logging';

export type AtsProvider = 'WORKDAY' | 'GREENHOUSE';

export interface ApplicantRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  atsProvider: AtsProvider;
  externalId: string;
  appliedDate: string;
}

export interface CredentialStatus {
  applicantId: string;
  credentialType: string;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED';
  verificationDate: string;
  provider: AtsProvider;
}

export class AtsConnector {
  constructor(private provider: AtsProvider, private apiKey: string) {}

  async sendCredentialStatus(status: CredentialStatus): Promise<void> {
    log.info(`Sending credential status to ${this.provider}`, status);

    // Simulate mapping and sending
    const payload = this.mapToProviderStatus(status);

    // Stub implementation
    await new Promise(resolve => setTimeout(resolve, 100));

    log.info(`Successfully sent status for ${status.applicantId}`);
  }

  async receiveApplicantRecord(externalId: string): Promise<ApplicantRecord> {
    log.info(`Fetching applicant record from ${this.provider}`, { externalId });

    // Stub implementation
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      id: 'local-id-placeholder',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      status: 'active',
      atsProvider: this.provider,
      externalId,
      appliedDate: new Date().toISOString()
    };
  }

  private mapToProviderStatus(status: CredentialStatus): any {
    if (this.provider === 'WORKDAY') {
      return {
        Worker_ID: status.applicantId,
        Certification_Status: status.status,
        Date: status.verificationDate
      };
    } else if (this.provider === 'GREENHOUSE') {
      return {
        candidate_id: status.applicantId,
        custom_fields: {
          credential_status: status.status,
          verified_at: status.verificationDate
        }
      };
    }
    return status;
  }
}


