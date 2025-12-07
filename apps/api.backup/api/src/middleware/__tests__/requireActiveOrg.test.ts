import { requireActiveOrg } from '../requireActiveOrg';

jest.mock('../../../../services/org/models/OrgMembership', () => ({
  getOrgMembership: jest.fn(),
  listMembershipsForUser: jest.fn(),
}));

jest.mock('../../../../services/audit/orgSwitchEvents', () => ({
  logOrgSwitchEvent: jest.fn(),
}));

const { getOrgMembership, listMembershipsForUser } = jest.requireMock(
  '../../../../services/org/models/OrgMembership'
);

const { logOrgSwitchEvent } = jest.requireMock(
  '../../../../services/audit/orgSwitchEvents'
);

describe('requireActiveOrg middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves org from header and attaches context', async () => {
    (getOrgMembership as jest.Mock).mockResolvedValue({
      orgId: 'org-123',
      role: 'ADMIN',
    });

    const req: any = {
      headers: { 'x-active-org-id': 'org-123' },
      user: { id: 'user-1' },
      session: {},
    };
    const res = createMockRes();
    const next = jest.fn();

    await requireActiveOrg(req, res as any, next);

    expect(req.activeOrgId).toBe('org-123');
    expect(req.activeOrgRole).toBe('ADMIN');
    expect(res.cookie).toHaveBeenCalledWith('activeOrgId', 'org-123', expect.any(Object));
    expect(next).toHaveBeenCalled();
  });

  it('auto-selects when only one membership exists', async () => {
    (listMembershipsForUser as jest.Mock).mockResolvedValue([
      { orgId: 'org-single', role: 'VIEWER', org: { partnerName: 'Single Org' } },
    ]);

    const req: any = {
      headers: {},
      user: { id: 'user-2' },
      session: {},
    };
    const res = createMockRes();
    const next = jest.fn();

    await requireActiveOrg(req, res as any, next);

    expect(req.activeOrgId).toBe('org-single');
    expect(next).toHaveBeenCalled();
  });

  it('returns 400 when multiple orgs and no selection provided', async () => {
    (listMembershipsForUser as jest.Mock).mockResolvedValue([
      { orgId: 'org-a', role: 'VIEWER' },
      { orgId: 'org-b', role: 'ADMIN' },
    ]);

    const req: any = {
      headers: {},
      user: { id: 'user-3' },
    };
    const res = createMockRes();

    await requireActiveOrg(req, res as any, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body?.error).toBe('active_org_required');
    expect(res.body?.orgs).toHaveLength(2);
  });

  it('returns 403 when membership missing for requested org', async () => {
    (getOrgMembership as jest.Mock).mockResolvedValue(null);

    const req: any = {
      headers: { 'x-active-org-id': 'org-missing' },
      user: { id: 'user-4' },
    };
    const res = createMockRes();

    await requireActiveOrg(req, res as any, jest.fn());

    expect(res.statusCode).toBe(403);
    expect(res.body?.error).toBe('org_access_denied');
  });

  it('returns 401 when user is not present', async () => {
    const req: any = { headers: {} };
    const res = createMockRes();

    await requireActiveOrg(req, res as any, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toBe('unauthorized');
  });

  it('logs org switch when previous selection differs', async () => {
    (getOrgMembership as jest.Mock).mockResolvedValue({
      orgId: 'org-new',
      role: 'ADMIN',
    });

    const req: any = {
      headers: { 'x-active-org-id': 'org-new' },
      session: { activeOrgId: 'org-old' },
      user: { id: 'user-switch' },
    };
    const res = createMockRes();

    await requireActiveOrg(req, res as any, jest.fn());

    expect(logOrgSwitchEvent).toHaveBeenCalledWith({
      userId: 'user-switch',
      oldOrgId: 'org-old',
      newOrgId: 'org-new',
    });
  });
});

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    locals: {} as Record<string, any>,
    cookie: jest.fn(),
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
}
