import { acceptApplication, requestMissingInfo, rejectApplication } from '../employerWorkflowService';
import prisma from '../../../graphql/prisma_client';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    application: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'app1', status: 'SUBMITTED' }),
      update: jest.fn().mockImplementation((args: any) => ({ id: 'app1', status: args.data.status }))
    },
    missingRequest: {
      create: jest.fn().mockResolvedValue({ id: 'req1', field: 'test', status: 'OPEN' })
    }
  }
}));

describe('Employer Workflow Actions', () => {
  test('accept moves to credentialing', async () => {
    const result = await acceptApplication('app1', 'employer1');
    expect(result.status).toBe('CREDENTIALING');
  });

  test('request info creates task', async () => {
    const { updated, request } = await requestMissingInfo('app1', 'license', 'Please upload', 'employer1');
    expect(updated.status).toBe('IN_REVIEW');
    expect(request.status).toBe('OPEN');
  });

  test('reject application closes application', async () => {
    const result = await rejectApplication('app1', 'employer1');
    expect(result.status).toBe('REJECTED');
  });
});
