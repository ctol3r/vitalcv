import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import router from '../list.js';
import { RevalidationTaskStatus } from '../../../../../services/revalidation/models/RevalidationTask.js';

const mockPrisma = {
  revalidationTask: {
    findMany: jest.fn(),
  },
} as any;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

describe('GET /api/revalidation/:clinicianId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.revalidationTask.findMany.mockResolvedValue([
      {
        id: 'task-1',
        clinicianId: 'clinician-1',
        type: 'PECOS',
        status: RevalidationTaskStatus.OPEN,
        source: 'SYSTEM',
        dueDate: new Date('2025-03-01T00:00:00Z'),
        notes: 'Due soon',
        metadata: { category: 'PECOS' },
        lastNotifiedAt: null,
        notificationCount: 0,
      },
    ]);
  });

  function buildApp(user?: any) {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = user;
      next();
    });
    app.use('/api/revalidation', router);
    return app;
  }

  it('requires authentication', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/revalidation/clinician-1');
    expect(res.status).toBe(401);
  });

  it('rejects unauthorized roles for other clinicians', async () => {
    const app = buildApp({ id: 'someone-else', roles: ['viewer'] });
    const res = await request(app).get('/api/revalidation/clinician-1');
    expect(res.status).toBe(403);
  });

  it('returns tasks for self', async () => {
    const app = buildApp({ id: 'clinician-1', roles: [] });
    const res = await request(app).get('/api/revalidation/clinician-1');
    expect(res.status).toBe(200);
    expect(res.body.tasks).toHaveLength(1);
    expect(res.body.tasks[0].id).toBe('task-1');
  });

  it('returns tasks for credentialing role', async () => {
    const app = buildApp({ id: 'org-admin', roles: ['credentialing_specialist'] });
    const res = await request(app).get('/api/revalidation/clinician-1');
    expect(res.status).toBe(200);
    expect(mockPrisma.revalidationTask.findMany).toHaveBeenCalledWith({
      where: {
        clinicianId: 'clinician-1',
        status: {
          in: [
            RevalidationTaskStatus.OPEN,
            RevalidationTaskStatus.IN_PROGRESS,
            RevalidationTaskStatus.OVERDUE,
          ],
        },
      },
      orderBy: [{ dueDate: 'asc' }],
    });
  });
});

