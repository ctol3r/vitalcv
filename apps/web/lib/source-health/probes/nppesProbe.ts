import type { SourceHealthSnapshot } from '../sourceHealthTypes';
import { runProbe, type ProbeDeps } from './runProbe';

const NPPES_HEALTH_URL =
  'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1234567893';

export async function probe(deps: ProbeDeps = {}): Promise<SourceHealthSnapshot> {
  return runProbe('NPPES', async ({ fetchImpl, signal }) => {
    try {
      const res = await fetchImpl(NPPES_HEALTH_URL, { signal });
      return { status: res.status, ok: res.ok };
    } catch (error) {
      return { error };
    }
  }, deps);
}
