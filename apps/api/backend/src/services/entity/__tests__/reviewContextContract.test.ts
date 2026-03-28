jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvOrganizationContext: {
      findUnique: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import {
  OrganizationContextValidationError,
  resolveShareOrganizationContext,
  validateOrganizationContext,
} from '../reviewContextContract';

const prismaMock = prisma as unknown as {
  vcvOrganizationContext: {
    findUnique: jest.Mock;
  };
};

describe('reviewContextContract', () => {
  beforeEach(() => {
    prismaMock.vcvOrganizationContext.findUnique.mockReset();
  });

  it('keeps bundle fallback and employer-request context resolution in the same normalized shape', async () => {
    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      requestorId: 'org-entity-1',
      contextType: 'EMPLOYMENT_REVIEW',
      status: 'PENDING',
      title: 'Providence employment review',
      description: null,
      webhookUrl: 'https://ehr.example.com/vitalcv',
      requestor: {
        id: 'org-entity-1',
        displayName: 'Providence',
      },
    });

    const legacy = await resolveShareOrganizationContext(validateOrganizationContext({
      organization_id: 'legacy-org',
      name: 'Legacy Providence',
      purpose_of_use: 'Employment review',
      callback_url: 'https://legacy.example.com/vitalcv',
    }));
    const employerRequest = await resolveShareOrganizationContext(validateOrganizationContext({
      organization_context_id: '550e8400-e29b-41d4-a716-446655440000',
    }));

    expect(legacy).toEqual({
      source: 'bundle_fallback',
      organizationContextId: null,
      requestorEntityId: null,
      organizationId: 'legacy-org',
      organizationName: 'Legacy Providence',
      callbackUrl: 'https://legacy.example.com/vitalcv',
      purposeOfUse: 'Employment review',
      contextType: null,
      status: null,
    });
    expect(employerRequest).toEqual({
      source: 'employer_request_context',
      organizationContextId: '550e8400-e29b-41d4-a716-446655440000',
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      callbackUrl: 'https://ehr.example.com/vitalcv',
      purposeOfUse: 'Providence employment review',
      contextType: 'EMPLOYMENT_REVIEW',
      status: 'PENDING',
    });
  });

  it('accepts an explicit organization_context_id without legacy fallback fields', () => {
    const context = validateOrganizationContext({
      organization_context_id: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(context).toEqual({
      organizationContextId: '550e8400-e29b-41d4-a716-446655440000',
    });
  });

  it('prefers persisted organization-context identity over legacy fallback fields when both are present', async () => {
    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue({
      id: '550e8400-e29b-41d4-a716-446655440000',
      requestorId: 'org-entity-1',
      contextType: 'EMPLOYMENT_REVIEW',
      status: 'ACTIVE',
      title: 'Providence employment review',
      description: 'Canonical description',
      webhookUrl: 'https://ehr.example.com/vitalcv',
      requestor: {
        id: 'org-entity-1',
        displayName: 'Providence',
      },
    });

    const resolved = await resolveShareOrganizationContext(validateOrganizationContext({
      organization_context_id: '550e8400-e29b-41d4-a716-446655440000',
      organization_id: 'legacy-org',
      name: 'Legacy Providence',
      purpose_of_use: 'Legacy employment review',
      callback_url: 'https://override.example.com/vitalcv',
    }));

    expect(resolved).toEqual({
      source: 'employer_request_context',
      organizationContextId: '550e8400-e29b-41d4-a716-446655440000',
      requestorEntityId: 'org-entity-1',
      organizationId: 'org-entity-1',
      organizationName: 'Providence',
      callbackUrl: 'https://ehr.example.com/vitalcv',
      purposeOfUse: 'Providence employment review',
      contextType: 'EMPLOYMENT_REVIEW',
      status: 'ACTIVE',
    });
  });

  it('fails closed when organization_context_id is invalid or missing', async () => {
    expect(() => validateOrganizationContext({
      organization_context_id: 'not-a-uuid',
    })).toThrow(OrganizationContextValidationError);
    expect(() => validateOrganizationContext({
      name: 'Missing org id',
      purpose_of_use: 'Employment review',
    })).toThrow(OrganizationContextValidationError);

    prismaMock.vcvOrganizationContext.findUnique.mockResolvedValue(null);

    await expect(resolveShareOrganizationContext(validateOrganizationContext({
      organization_context_id: '550e8400-e29b-41d4-a716-446655440000',
    }))).rejects.toMatchObject<Partial<OrganizationContextValidationError>>({
      name: 'OrganizationContextValidationError',
      statusCode: 400,
      message: 'organization_context.organization_context_id is invalid.',
    });
  });
});
