import type { SourceHealthSnapshot } from '../sourceHealthTypes';
import { runProbe, type ProbeDeps } from './runProbe';

const OIG_HEALTH_URL = 'https://oig.hhs.gov/exclusions/exclusions_list.asp';

export async function probe(deps: ProbeDeps = {}): Promise<SourceHealthSnapshot> {
  return runProbe('OIG_LEIE', async ({ fetchImpl, signal }) => {
    try {
      const res = await fetchImpl(OIG_HEALTH_URL, {
        method: 'HEAD',
        signal,
      });
      return { status: res.status, ok: res.ok };
    } catch (error) {
      return { error };
    }
  }, deps);
}
