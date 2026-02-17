import type { NormalizedCredentialPayload, ProviderType, CredentialType } from '../types/psv';

export interface PsvAdapter {
  providerType: ProviderType;
  credentialType: CredentialType;
  verify(npi: string): Promise<NormalizedCredentialPayload>;
}

export type AdapterKey = `${ProviderType}:${CredentialType}`;

export class AdapterRegistry {
  private adapters = new Map<AdapterKey, PsvAdapter>();

  register(adapter: PsvAdapter): void {
    const key: AdapterKey = `${adapter.providerType}:${adapter.credentialType}`;
    this.adapters.set(key, adapter);
  }

  getAdapter(providerType: ProviderType, credentialType: CredentialType): PsvAdapter | undefined {
    const key: AdapterKey = `${providerType}:${credentialType}`;
    return this.adapters.get(key);
  }

  listRegistered(): AdapterKey[] {
    return Array.from(this.adapters.keys());
  }
}
