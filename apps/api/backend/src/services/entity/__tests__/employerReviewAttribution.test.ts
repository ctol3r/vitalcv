jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvOrganizationContext: {
      findUnique: jest.fn(),
    },
    vcvOrgContextSubject: {
      findUnique: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  EmployerReviewAttributionError,
  resolveEmployerReviewAttribution,
} from '../employerReviewAttribution';

const prismaMock = prisma as unknown as {
  vcvOrganizationContext: {
    findUnique: jest.Mock;
  };
  vcvOrgContextSubject: {
    findUnique: jest.Mock;
  };
  bundleShareEvent: {
    findFirst: jest.Mock;
  };
};

describe('employerReviewAttribution', () => {
  beforeEach(() => {
    prismaMock.vcvOrganizationContext.findUnique.mockReset();
    prismaMock.vcvOrgContextSubject.findUnique.mockReset();
    prismaMock.bundleShareEvent.findFirst.mockReset();
    prismaMock.vcvOrganizationContext.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'ctx-1') {
        return {
          id: 'ctx-1',
          requestorId: 'org-entity-1',
          contextType: 'EMPLOYMENT_REVIEW',
          status: 'PENDING',
          title: 'Employment review',
          description: null,
          webhookUrl: null,
          requestor: {
            id: 'org-entity-1',
            displayName: 'Mercy General',
          },
        };
      }

      if (where.id === 'ctx-2') {
        return {
          id: 'ctx-2',
          requestorId: 'org-entity-2',
          contextType: 'EMPLOYMENT_REVIEW',
          status: 'PENDING',
          title: 'Employment review',
          description: null,
          webhookUrl: null,
          requestor: {
            id: 'org-entity-2',
            displayName: 'Mercy General',
          },
        };
      }

      return null;
    });
    prismaMock.vcvOrgContextSubject.findUnique.mockResolvedValue({
      id: 'ctx-subject-1',
    });
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue(null);
  });

  it('normalizes an employer-request context into the canonical attribution shape', async () => {
    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      organizationContextId: 'ctx-1',
    })).resolves.toEqual({
      source: 'organization_context',
      organizationContextId: 'ctx-1',
      bundleShareEventId: null,
      bundleId: null,
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Mercy General',
      purposeOfUse: 'Employment review',
    });
  });

  it('keeps bundle fallback aligned with the same canonical organization context', async () => {
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      id: 'share-1',
      bundleId: 'bundle-1',
      subjectEntityId: 'entity-1',
      organizationContextId: 'ctx-1',
      organizationId: 'legacy-org',
      organizationName: 'Legacy org',
      purposeOfUse: 'Legacy purpose',
    });

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      bundleId: 'bundle-1',
    })).resolves.toEqual({
      source: 'bundle_share',
      organizationContextId: 'ctx-1',
      bundleShareEventId: 'share-1',
      bundleId: 'bundle-1',
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Mercy General',
      purposeOfUse: 'Employment review',
    });
  });

  it('returns an unscoped attribution when review scope is missing', async () => {
    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
    })).resolves.toEqual({
      source: 'unscoped',
      organizationContextId: null,
      bundleShareEventId: null,
      bundleId: null,
      requestorEntityId: null,
      organizationId: null,
      organizationName: null,
      purposeOfUse: null,
    });
  });

  it('fails closed when an explicit organization context is invalid', async () => {
    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue(null);

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      organizationContextId: 'ctx-missing',
    })).rejects.toMatchObject({
      name: 'EmployerReviewAttributionError',
      statusCode: 404,
      message: 'Review context not found.',
    });
  });

  it('fails closed when an explicit organization context is not linked to the review subject', async () => {
    prismaMock.vcvOrgContextSubject.findUnique.mockResolvedValueOnce(null);
    prismaMock.bundleShareEvent.findFirst.mockResolvedValueOnce(null);

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      organizationContextId: 'ctx-2',
    })).rejects.toMatchObject({
      name: 'EmployerReviewAttributionError',
      statusCode: 400,
      message: 'Review context is not linked to this review subject.',
    });
  });

  it('fails closed when an explicit organization context targets its own requestor as the subject', async () => {
    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue({
      id: 'ctx-2',
      requestorId: 'entity-1',
      contextType: 'EMPLOYMENT_REVIEW',
      status: 'PENDING',
      title: 'Employment review',
      description: null,
      webhookUrl: null,
      requestor: {
        id: 'entity-1',
        displayName: 'Mercy General',
      },
    });

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      organizationContextId: 'ctx-2',
    })).rejects.toMatchObject({
      name: 'EmployerReviewAttributionError',
      statusCode: 400,
      message: 'Review context cannot target its requesting organization as the subject.',
    });
  });

  it('fails closed when a bundle fallback points at a different subject', async () => {
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      id: 'share-2',
      bundleId: 'bundle-2',
      subjectEntityId: 'entity-2',
      organizationContextId: null,
      organizationId: 'org-2',
      organizationName: 'Other org',
      purposeOfUse: 'Credential review',
    });

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      bundleId: 'bundle-2',
    })).rejects.toMatchObject({
      name: 'EmployerReviewAttributionError',
      statusCode: 404,
      message: 'Bundle review context does not match this review subject.',
    });
  });

  it('fails closed when bundle fallback and requested organization context diverge', async () => {
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      id: 'share-1',
      bundleId: 'bundle-1',
      subjectEntityId: 'entity-1',
      organizationContextId: 'ctx-2',
      organizationId: 'legacy-org-2',
      organizationName: 'Legacy Mercy',
      purposeOfUse: 'Legacy employment review',
    });

    await expect(resolveEmployerReviewAttribution({
      entityId: 'entity-1',
      organizationContextId: 'ctx-1',
      bundleId: 'bundle-1',
    })).rejects.toMatchObject<Partial<EmployerReviewAttributionError>>({
      name: 'EmployerReviewAttributionError',
      statusCode: 400,
      message: 'Bundle review context does not match the requested organization context.',
    });
  });
});
