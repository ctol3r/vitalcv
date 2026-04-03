import { TrustStateResolver, type TrustState } from '@vitalcv/trust-state';
import type { TrustStateApiDependencies } from './contracts';

export async function resolveTrustState(
  clinician_id: string,
  deps: TrustStateApiDependencies,
): Promise<TrustState> {
  const resolver = new TrustStateResolver(deps);
  return resolver.resolve(clinician_id);
}
