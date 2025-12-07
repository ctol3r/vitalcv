import { runRegionHeartbeat } from '../../global/regionHeartbeat';
import { RegionConfigStore } from '../../../infra/global/models/RegionConfig';

describe('RegionHeartbeat job', () => {
  it('records metrics and alerts on degradation', async () => {
    const store = new RegionConfigStore({
      // @ts-expect-error override list for test
      read: undefined,
      write: undefined,
    });
    // @ts-expect-error monkey patch list
    store.list = jest.fn().mockResolvedValue([
      { regionId: 'r1', apiEndpoint: 'https://r1', queueEndpoint: '', dbClusterId: '', priority: 0, failoverMode: 'active-active' as const },
    ]);

    const probe = {
      fetchLatencyMs: jest.fn().mockResolvedValue(1200),
      checkHealth: jest.fn().mockResolvedValue(true),
    };
    const sink = {
      record: jest.fn().mockResolvedValue(undefined),
      alert: jest.fn().mockResolvedValue(undefined),
    };

    await runRegionHeartbeat(probe as any, sink as any, { store });
    expect(sink.record).toHaveBeenCalledWith('r1', 1200, true);
    expect(sink.alert).toHaveBeenCalled();
  });
});


