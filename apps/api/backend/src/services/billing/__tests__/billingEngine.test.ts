import { processApplicationBilling, getRevenueMetrics } from '../billingEngine';

jest.mock('../../../graphql/prisma_client', () => {
  return {
    __esModule: true,
    default: {
      application: {
        update: jest.fn().mockImplementation(({ data }) => ({ id: 'app1', price: data.price })),
        findMany: jest.fn().mockImplementation(({ where }) => {
          if (where?.status === 'STARTED') {
            return Promise.resolve([
              { id: 'app2', price: 100, status: 'STARTED' },
              { id: 'app3', price: 0, status: 'STARTED' }
            ]);
          }
          return Promise.resolve([
            { id: 'app1', price: 100, status: 'SUBMITTED' },
            { id: 'app2', price: 100, status: 'STARTED' },
            { id: 'app3', price: 0, status: 'STARTED' }
          ]);
        })
      }
    }
  };
});

describe('Billing Engine', () => {
  test('process billing sets price based on pilot mode', async () => {
    const regular = await processApplicationBilling('app1', false);
    expect(regular.price).toBe(100);

    const pilot = await processApplicationBilling('app2', true);
    expect(pilot.price).toBe(0);
  });

  test('calculates revenue metrics correctly', async () => {
    const metrics = await getRevenueMetrics();
    expect(metrics.total_revenue).toBe(200);
    expect(metrics.revenue_per_application).toBe(200 / 3);
    expect(metrics.revenue_per_hire).toBe(200 / 2);
  });
});
