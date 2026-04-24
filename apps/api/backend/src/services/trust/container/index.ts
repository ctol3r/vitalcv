import type {
  TrustContainerConfig,
  TrustContainerProvider,
  TrustContainerProviderKind,
} from './trustContainerContract';
import { DockTrustContainer } from './dockTrustContainer';
import { MockTrustContainer } from './mockTrustContainer';

export * from './trustContainerContract';
export * from './trustContainerManifest';
export { DockTrustContainer } from './dockTrustContainer';
export { MockTrustContainer } from './mockTrustContainer';

function resolveProviderKind(value: string | undefined): TrustContainerProviderKind {
  if (!value) {
    return 'mock';
  }
  if (value === 'dock' || value === 'mock') {
    return value;
  }
  throw new Error(`Unsupported trust container provider: ${value}`);
}

export function createTrustContainer(
  config?: Partial<TrustContainerConfig>,
): TrustContainerProvider {
  const providerType = resolveProviderKind(config?.provider ?? process.env.TRUST_CONTAINER_PROVIDER);

  if (providerType === 'dock') {
    return new DockTrustContainer({
      provider: 'dock',
      apiUrl: config?.apiUrl ?? process.env.DOCK_API_URL,
      apiKey: config?.apiKey ?? process.env.DOCK_API_KEY,
      issuerDid: config?.issuerDid ?? process.env.DOCK_ISSUER_DID,
      network: config?.network ?? process.env.DOCK_NETWORK,
    });
  }

  return new MockTrustContainer();
}
