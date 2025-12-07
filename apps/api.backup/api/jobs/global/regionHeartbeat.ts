import { RegionConfigStore } from '../../infra/global/models/RegionConfig';

export interface HeartbeatProbe {
  fetchLatencyMs(endpoint: string): Promise<number>;
  checkHealth(endpoint: string): Promise<boolean>;
}

export interface HeartbeatMetricsSink {
  record(regionId: string, latencyMs: number, healthy: boolean): Promise<void>;
  alert(regionId: string, message: string): Promise<void>;
}

export async function runRegionHeartbeat(
  probe: HeartbeatProbe,
  sink: HeartbeatMetricsSink,
  opts?: { store?: RegionConfigStore },
): Promise<void> {
  const store = opts?.store || new RegionConfigStore();
  const regions = await store.list();
  for (const r of regions) {
    const latency = await probe.fetchLatencyMs(r.apiEndpoint);
    const healthy = await probe.checkHealth(r.apiEndpoint);
    await sink.record(r.regionId, latency, healthy);
    if (!healthy || latency > 1000) {
      await sink.alert(r.regionId, !healthy ? 'unhealthy' : `high-latency:${latency}`);
    }
  }
}


