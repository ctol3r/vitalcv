/**
 * Wave 206 — PSV Adapter Registry
 */
import type { IPsvAdapter, PsvArtifact } from './types';
import { NursysENotifyAdapter } from './adapters/nursysAdapter';
import { DcaBreezeAdapter } from './adapters/dcaBreezeAdapter';
import { FsmbAdapter } from './adapters/fsmbAdapter';

const registry = new Map<string, IPsvAdapter>();

export function registerAdapter(a: IPsvAdapter): void { registry.set(a.config.sourceId, a); }
export function getAdapter(sourceId: string): IPsvAdapter | undefined { return registry.get(sourceId); }
export function getAdaptersForNpi(npi: string): IPsvAdapter[] { return Array.from(registry.values()).filter((a) => a.supports(npi)); }
export function listAdapters(): { sourceId: string; displayName: string; methodologyVersion: string }[] {
  return Array.from(registry.values()).map((a) => ({ sourceId: a.config.sourceId, displayName: a.config.sourceDisplayName, methodologyVersion: a.config.methodologyVersion }));
}

export async function runDeltaScan(npi: string): Promise<PsvArtifact[]> {
  const adapters = getAdaptersForNpi(npi);
  const results = await Promise.allSettled(adapters.map((a) => a.fetchArtifact(npi)));
  return results.flatMap((r) => r.status === 'fulfilled' ? [r.value] : []);
}

// Register defaults
registerAdapter(new NursysENotifyAdapter());
registerAdapter(new DcaBreezeAdapter());
registerAdapter(new FsmbAdapter());
