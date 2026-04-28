import type { SourceHealthSnapshot } from '../sourceHealthTypes';
import { runProbe, type ProbeDeps } from './runProbe';

const PECOS_HEALTH_URL = 'https://data.cms.gov/provider-enrollment';

export async function probe(deps: ProbeDeps = {}): Promise<SourceHealthSnapshot> {
  return runProbe('PECOS', async ({ fetchImpl, signal }) => {
    try {
      const res = await fetchImpl(PECOS_HEALTH_URL, {
        method: 'HEAD',
        signal,
      });
      return { status: res.status, ok: res.ok };
    } catch (error) {
      return { error };
    }
  }, deps);
}
