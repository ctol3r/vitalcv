export type AdapterTarget = 'greenhouse' | 'workday';

export type ReadinessLevel = 'not_ready' | 'in_review' | 'ready' | 'unknown';

export interface LicenseRecord {
  state?: string;
  number?: string;
  status?: string;
  expiresOn?: string;
}

export interface CredentialEvidence {
  id?: string;
  type: string;
  issuer?: string;
  issuedAt?: string;
  status?: string;
}

export interface CredentialPacket {
  candidateId: string;
  fullName: string;
  email: string;
  phone?: string;
  npi?: string;
  specialty?: string;
  readinessScore?: number;
  readinessLevel?: ReadinessLevel;
  readinessFactors?: Record<string, unknown>;
  licenses?: LicenseRecord[];
  credentials?: CredentialEvidence[];
}

export interface ReadinessWebhookPayload {
  target: AdapterTarget;
  event: string;
  updatedAt: string;
  packet: CredentialPacket;
}

export interface AtsSyncResult {
  adapter: AdapterTarget;
  transmitted: boolean;
  reference?: string;
  payload: unknown;
  status?: number;
  responseBody?: unknown;
}

export abstract class AtsAdapter {
  protected constructor(
    protected readonly config: {
      webhookUrlEnv: string;
      apiKeyEnv?: string;
      adapter: AdapterTarget;
      label: string;
    },
  ) {}

  protected splitName(fullName?: string): { firstName: string; lastName: string } {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: 'Unknown', lastName: 'Candidate' };
    if (parts.length === 1) return { firstName: parts[0], lastName: 'Candidate' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts.at(-1) || '' };
  }

  protected normalizePhone(phone?: string): string | undefined {
    if (!phone) return undefined;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return undefined;
    if (digits.startsWith('1') && digits.length === 11) return `+${digits}`;
    if (digits.length === 10) return `+1${digits}`;
    return `+${digits}`;
  }

  protected mapCredentialsToArtifacts(credentials?: CredentialEvidence[]):
    | Array<{ name: string; issuer?: string; issued_at?: string; status?: string; reference_id?: string }>
    | undefined {
    if (!credentials?.length) return undefined;
    return credentials.map((cred) => ({
      name: cred.type,
      issuer: cred.issuer,
      issued_at: cred.issuedAt,
      status: cred.status,
      reference_id: cred.id,
    }));
  }

  protected mapLicenses(licenses?: LicenseRecord[]):
    | Array<{ state?: string; number?: string; status?: string; expires_on?: string }>
    | undefined {
    if (!licenses?.length) return undefined;
    return licenses.map((lic) => ({
      state: lic.state,
      number: lic.number,
      status: lic.status,
      expires_on: lic.expiresOn,
    }));
  }

  protected getWebhookUrl(): string | null {
    const key = this.config.webhookUrlEnv;
    const value = key ? String(process.env[key] || '').trim() : '';
    return value || null;
  }

  protected getApiKey(): string | null {
    if (!this.config.apiKeyEnv) return null;
    const value = String(process.env[this.config.apiKeyEnv] || '').trim();
    return value || null;
  }

  protected redact(value: string): string {
    if (!value) return '';
    if (value.length <= 8) return '***';
    return `${value.slice(0, 4)}...${value.slice(-2)}`;
  }

  protected abstract buildReadinessPayload(
    packet: CredentialPacket,
    updatedAt: string,
  ): Record<string, unknown>;

  async sendReadinessUpdate(payload: ReadinessWebhookPayload): Promise<AtsSyncResult> {
    const webhookUrl = this.getWebhookUrl();
    const readinessPayload = this.buildReadinessPayload(payload.packet, payload.updatedAt);

    if (!webhookUrl) {
      return {
        adapter: this.config.adapter,
        transmitted: false,
        reference: 'webhook_not_configured',
        payload: readinessPayload,
      };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = this.getApiKey();
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(readinessPayload),
    });

    const text = await resp.text().catch(() => '');
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }

    return {
      adapter: this.config.adapter,
      transmitted: resp.ok,
      reference: resp.headers.get('x-request-id') || undefined,
      payload: readinessPayload,
      status: resp.status,
      responseBody: parsed,
    };
  }
}
