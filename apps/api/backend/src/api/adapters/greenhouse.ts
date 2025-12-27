import { AtsAdapter, CredentialPacket } from './base';

export class GreenhouseAdapter extends AtsAdapter {
  constructor() {
    super({
      webhookUrlEnv: 'GREENHOUSE_WEBHOOK_URL',
      apiKeyEnv: 'GREENHOUSE_API_TOKEN',
      adapter: 'greenhouse',
      label: 'Greenhouse',
    });
  }

  protected buildReadinessPayload(packet: CredentialPacket, updatedAt: string): Record<string, unknown> {
    const { firstName, lastName } = this.splitName(packet.fullName);
    return {
      event: 'readiness.updated',
      adapter: 'greenhouse',
      updated_at: updatedAt,
      candidate: {
        prospect_id: packet.candidateId,
        first_name: firstName,
        last_name: lastName,
        emails: [packet.email],
        phone_numbers: packet.phone ? [this.normalizePhone(packet.phone)] : [],
        custom_fields: {
          readiness_score: packet.readinessScore ?? null,
          readiness_level: packet.readinessLevel ?? 'unknown',
          readiness_factors: packet.readinessFactors ?? {},
          npi: packet.npi ?? null,
          specialty: packet.specialty ?? null,
        },
        credentials: this.mapCredentialsToArtifacts(packet.credentials),
        licenses: this.mapLicenses(packet.licenses),
      },
    };
  }
}
