import { CernerAdapter } from './cernerAdapter.js';
import { EpicAdapter } from './epicAdapter.js';
import { MeditechAdapter } from './meditechAdapter.js';
import type { EhrAdapter } from './types.js';
import type { EhrSystemType } from '../models/EHRSynchronization.js';

const adapterRegistry: Record<EhrSystemType, EhrAdapter> = {
  epic: new EpicAdapter(),
  cerner: new CernerAdapter(),
  meditech: new MeditechAdapter(),
};

export function getEhrAdapter(system: string): EhrAdapter | undefined {
  const key = system.toLowerCase() as EhrSystemType;
  return adapterRegistry[key];
}


