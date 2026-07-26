jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    searchObject: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
      findFirst: jest.fn(),
    },
    searchObjectACL: {
      findMany: jest.fn(),
    },
    searchIndexRun: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../employers/employerService', () => ({
  searchEmployers: jest.fn().mockResolvedValue([]),
  getEmployerBySlug: jest.fn(),
}));

jest.mock('../../matcha/opportunityRegistry', () => ({
  listOpportunities: jest.fn(() => []),
}));

jest.mock('../../providers/connectors/connectorFactory', () => ({
  getAllConnectorModes: jest.fn(() => ({
    STATE_BOARD: 'sandbox',
    OIG: 'sandbox',
    ABMS: 'sandbox',
    CAQH: 'sandbox',
    NPDB: 'sandbox',
  })),
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { querySearch } from '../searchIndex';

const prismaMock = prisma as unknown as {
  searchObject: {
    findMany: jest.Mock;
  };
  searchObjectACL: {
    findMany: jest.Mock;
  };
};

describe('querySearch', () => {
  beforeEach(() => {
    prismaMock.searchObject.findMany.mockReset();
    prismaMock.searchObjectACL.findMany.mockReset();
  });

  it('enforces aclLevel, orgId, and roleRequired without leaking holder-only content to verifier queries', async () => {
    prismaMock.searchObject.findMany.mockResolvedValue([
      {
        id: 'public-1',
        type: 'PUBLIC_PAGE',
        title: 'Public Doc',
        body: 'shared search content',
        sourceUrl: '/public',
        referenceId: 'public-doc',
        aclLevel: 'PUBLIC',
        metadata: { provenance: 'seed_public_page' },
        freshAt: new Date('2026-03-01T00:00:00Z'),
        indexedAt: new Date('2026-03-01T00:00:00Z'),
        active: true,
      },
      {
        id: 'verifier-1',
        type: 'FAQ_DOC',
        title: 'Verifier Doc',
        body: 'org specific verifier search content',
        sourceUrl: '/verifier',
        referenceId: 'verifier-doc',
        aclLevel: 'AUTHENTICATED',
        metadata: {},
        freshAt: new Date('2026-03-02T00:00:00Z'),
        indexedAt: new Date('2026-03-02T00:00:00Z'),
        active: true,
      },
      {
        id: 'holder-1',
        type: 'FAQ_DOC',
        title: 'Holder Doc',
        body: 'holder only content',
        sourceUrl: '/holder',
        referenceId: 'holder-doc',
        aclLevel: 'HOLDER',
        metadata: {},
        freshAt: new Date('2026-03-03T00:00:00Z'),
        indexedAt: new Date('2026-03-03T00:00:00Z'),
        active: true,
      },
      {
        id: 'other-org-1',
        type: 'FAQ_DOC',
        title: 'Other Org Doc',
        body: 'other org verifier content',
        sourceUrl: '/other-org',
        referenceId: 'other-org-doc',
        aclLevel: 'AUTHENTICATED',
        metadata: {},
        freshAt: new Date('2026-03-03T00:00:00Z'),
        indexedAt: new Date('2026-03-03T00:00:00Z'),
        active: true,
      },
    ]);
    // SearchObject has no `acl` relation — the service stitches these rows
    // from the standalone SearchObjectACL table by searchObjectId.
    prismaMock.searchObjectACL.findMany.mockResolvedValue([
      { searchObjectId: 'verifier-1', orgId: 'org-1', roleRequired: 'VERIFIER' },
      { searchObjectId: 'other-org-1', orgId: 'org-2', roleRequired: 'VERIFIER' },
    ]);

    const response = await querySearch({
      q: 'content',
      aclLevel: 'VERIFIER',
      orgId: 'org-1',
      roles: ['VERIFIER'],
    });

    expect(response.results.map((result) => result.title)).toEqual(
      expect.arrayContaining(['Public Doc', 'Verifier Doc']),
    );
    expect(response.results.map((result) => result.title)).not.toContain('Holder Doc');
    expect(response.results.map((result) => result.title)).not.toContain('Other Org Doc');
    expect(response.results[0]).toHaveProperty('provenance');
    expect(response.results[0]).toHaveProperty('freshnessStatus');
  });
});
