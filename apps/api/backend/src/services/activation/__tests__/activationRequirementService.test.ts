const prismaMock = {
  activationRequirement: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  auditEvent: { create: jest.fn() },
  outboxEvent: { upsert: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

import {
  getApplicationActivation,
  instantiateActivationRequirements,
  resolveActivationRequirement,
  type RequirementSeed,
} from '../activationRequirementService';

const seed = (overrides: Partial<RequirementSeed> = {}): RequirementSeed => ({
  category: 'evidence',
  label: 'State license',
  necessity: 'required',
  owner: 'clinician',
  ...overrides,
});

beforeEach(() => {
  for (const group of Object.values(prismaMock)) {
    if (typeof group === 'function') (group as jest.Mock).mockReset();
    else for (const fn of Object.values(group)) (fn as jest.Mock).mockReset();
  }
  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));
  prismaMock.activationRequirement.findFirst.mockResolvedValue(null);
  prismaMock.activationRequirement.createMany.mockResolvedValue({ count: 0 });
  prismaMock.activationRequirement.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.auditEvent.create.mockResolvedValue({ id: 'audit-1' });
  prismaMock.outboxEvent.upsert.mockResolvedValue({ id: 'outbox-1' });
});

describe('instantiateActivationRequirements', () => {
  it('creates requirements and audits, marking accepted evidence as met (never re-requested)', async () => {
    const res = await instantiateActivationRequirements({
      applicationId: 'app-1',
      organizationId: 'org-1',
      requirements: [
        seed({ sourceRequirementId: 'lic_ca', label: 'CA license' }),
        seed({ sourceRequirementId: 'dea', label: 'DEA', necessity: 'preferred' }),
      ],
      acceptedEvidenceKeys: ['lic_ca'],
    });

    expect(res).toEqual({ created: 2, skipped: false });
    const rows = prismaMock.activationRequirement.createMany.mock.calls[0][0].data;
    expect(rows.find((r: { sourceRequirementId: string }) => r.sourceRequirementId === 'lic_ca').status).toBe('met');
    expect(rows.find((r: { sourceRequirementId: string }) => r.sourceRequirementId === 'lic_ca').resolvedBy).toBe('system:head_start');
    expect(rows.find((r: { sourceRequirementId: string }) => r.sourceRequirementId === 'dea').status).toBe('not_started');
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'ACTIVATION_REQUIREMENTS_INSTANTIATED' }) }),
    );
  });

  it('is idempotent — does not re-create when requirements already exist', async () => {
    prismaMock.activationRequirement.findFirst.mockResolvedValue({ id: 'existing' });
    const res = await instantiateActivationRequirements({ applicationId: 'app-1', organizationId: 'org-1', requirements: [seed()] });
    expect(res).toEqual({ created: 0, skipped: true });
    expect(prismaMock.activationRequirement.createMany).not.toHaveBeenCalled();
  });
});

describe('resolveActivationRequirement', () => {
  it('writes the update, audit, and outbound intent in one transaction', async () => {
    const order: string[] = [];
    prismaMock.activationRequirement.findUnique.mockResolvedValue({
      id: 'r1', organizationId: 'org-1', applicationId: 'app-1', status: 'submitted', owner: 'clinician', policyVersion: null,
    });
    prismaMock.auditEvent.create.mockImplementation(async () => { order.push('audit'); return { id: 'a' }; });
    prismaMock.activationRequirement.updateMany.mockImplementation(async () => { order.push('update'); return { count: 1 }; });
    prismaMock.outboxEvent.upsert.mockImplementation(async () => { order.push('outbox'); return { id: 'o' }; });

    const res = await resolveActivationRequirement({ requirementId: 'r1', organizationId: 'org-1', toStatus: 'met', actorId: 'user-1' });
    expect(res).toEqual({ ok: true });
    expect(order).toEqual(['update', 'audit', 'outbox']);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // met is resolved → resolvedBy/resolvedAt set
    expect(prismaMock.activationRequirement.updateMany.mock.calls[0][0].data.resolvedBy).toBe('user-1');
  });

  it('rejects a transition the state machine forbids — no audit, no update', async () => {
    prismaMock.activationRequirement.findUnique.mockResolvedValue({ id: 'r1', organizationId: 'org-1', applicationId: 'app-1', status: 'not_started' });
    const res = await resolveActivationRequirement({ requirementId: 'r1', organizationId: 'org-1', toStatus: 'met', actorId: 'user-1' });
    expect(res).toEqual({ ok: false, reason: 'invalid_transition' });
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
    expect(prismaMock.activationRequirement.updateMany).not.toHaveBeenCalled();
  });

  it('refuses a requirement outside the acting organization', async () => {
    prismaMock.activationRequirement.findUnique.mockResolvedValue({ id: 'r1', organizationId: 'org-OTHER', applicationId: 'app-1', status: 'submitted' });
    const res = await resolveActivationRequirement({ requirementId: 'r1', organizationId: 'org-1', toStatus: 'met', actorId: 'user-1' });
    expect(res).toEqual({ ok: false, reason: 'wrong_tenant' });
    expect(prismaMock.activationRequirement.updateMany).not.toHaveBeenCalled();
  });

  it('returns not_found for a missing requirement', async () => {
    prismaMock.activationRequirement.findUnique.mockResolvedValue(null);
    const res = await resolveActivationRequirement({ requirementId: 'nope', organizationId: 'org-1', toStatus: 'met', actorId: 'user-1' });
    expect(res).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('getApplicationActivation', () => {
  it('derives start-readiness from the persisted requirements', async () => {
    prismaMock.activationRequirement.findMany.mockResolvedValue([
      { id: 'r1', necessity: 'required', status: 'met', createdAt: new Date() },
      { id: 'r2', necessity: 'required', status: 'submitted', createdAt: new Date() },
    ]);
    const { readiness } = await getApplicationActivation('app-1');
    expect(readiness.startReady).toBe(false);
    expect(readiness.blocking.map((b) => b.id)).toEqual(['r2']);
  });
});
