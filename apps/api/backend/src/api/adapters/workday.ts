import { AtsAdapter, CredentialPacket } from './base';

export class WorkdayAdapter extends AtsAdapter {
  constructor() {
    super({
      webhookUrlEnv: 'WORKDAY_WEBHOOK_URL',
      apiKeyEnv: 'WORKDAY_ACCESS_TOKEN',
      adapter: 'workday',
      label: 'Workday',
    });
  }

  protected buildReadinessPayload(packet: CredentialPacket, updatedAt: string): Record<string, unknown> {
    const { firstName, lastName } = this.splitName(packet.fullName);
    return {
      event: 'readiness.updated',
      adapter: 'workday',
      updated_at: updatedAt,
      worker: {
        reference_id: packet.candidateId,
        person_name: { given: firstName, family: lastName },
        contact: { email: packet.email, phone: this.normalizePhone(packet.phone) },
        identifiers: {
          npi: packet.npi ?? undefined,
          specialty: packet.specialty ?? undefined,
        },
        readiness: {
          score: packet.readinessScore ?? null,
          level: packet.readinessLevel ?? 'unknown',
          factors: packet.readinessFactors ?? {},
        },
        licenses: this.mapLicenses(packet.licenses),
        certifications: this.mapCredentialsToArtifacts(packet.credentials)?.map((cred) => ({
          name: cred.name,
          issuer: cred.issuer,
          issued_on: cred.issued_at,
          status: cred.status,
          reference_id: cred.reference_id,
        })),
      },
    };
  }
}
