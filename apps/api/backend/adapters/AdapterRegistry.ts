import type { ProviderType, CredentialType } from "../types/psv";
import type { PsvAdapter } from "./types";

export class AdapterRegistry {
  private adapters: PsvAdapter[] = [];

  register(adapter: PsvAdapter): void {
    this.adapters.push(adapter);
  }

  getAdapter(
    providerType: ProviderType,
    credentialType: CredentialType
  ): PsvAdapter | undefined {
    return this.adapters.find(
      (adapter) =>
        adapter.supportedProviderTypes.includes(providerType) &&
        adapter.supportedCredentialTypes.includes(credentialType)
    );
  }
}
