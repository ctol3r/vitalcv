import { recommendPartnerRoute } from './partnerRouter';
import type {
  IssuerResponse,
  IssuerVerificationRequest,
  PolicyReviewActor,
  PSVReceiptLimitation,
  PSVReceiptScope,
  VerificationClaimType,
} from './types';

export type IssuerSurfaceFactoryKind =
  | 'issuer-verify'
  | 'issuer-review'
  | 'policy-review'
  | 'psv-receipt'
  | 'psv-reuse'
  | 'audit-boundary'
  | 'persistence-adapter'
  | 'backend-persistence';

interface IssuerSurfaceFactoryInput {
  surface: IssuerSurfaceFactoryKind;
  requestId?: string;
  receiptId?: string;
}

export interface IssuerSurfaceFactoryFixture {
  surface: IssuerSurfaceFactoryKind;
  requestId: string;
  receiptId?: string;
  roundTripId: string;
  claimType: VerificationClaimType;
  request: IssuerVerificationRequest;
  response: IssuerResponse;
  actor: PolicyReviewActor;
  scope: PSVReceiptScope;
  limitations: PSVReceiptLimitation[];
  receiptCandidateId: string;
  claimId: string;
}

export function createIssuerSurfaceFactoryFixture(
  input: IssuerSurfaceFactoryInput,
): IssuerSurfaceFactoryFixture {
  const requestId = input.requestId ?? `req-${input.receiptId ?? 'demo'}`;
  const receiptId = input.receiptId;
  const claimType: VerificationClaimType = 'residency';
  const sourceOrganizationName = 'Demo GME Office';

  return {
    surface: input.surface,
    requestId,
    receiptId,
    roundTripId: `${input.surface}:${receiptId ?? requestId}`,
    claimType,
    receiptCandidateId: `rc-${requestId}`,
    claimId: `claim-${requestId}`,
    actor: {
      actorId: 'demo-reviewer',
      displayName: 'Demo Reviewer',
      role: 'demo',
    },
    request: {
      requestId,
      claimType,
      claimSummary: 'Residency: Internal Medicine, 2018-2021',
      issuerCandidate: {
        candidateId: 'cand-demo',
        organizationName: sourceOrganizationName,
        contactRole: 'GME Coordinator',
        source: 'clinician_provided',
      },
      route: recommendPartnerRoute(claimType),
      consent: {
        consentId: 'consent-demo',
        scope: 'verify_residency',
        status: 'granted',
        consentedAt: '2026-04-26T00:00:00.000Z',
      },
      status: 'confirmed',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T01:00:00.000Z',
      history: [],
    },
    response: {
      responseId: 'resp-demo',
      status: 'confirmed',
      respondedAt: '2026-04-26T01:00:00.000Z',
      responderName: 'J. Doe',
      responderRole: 'Program Coordinator',
      reviewRequired: true,
      freeText: 'Confirmed completion of Internal Medicine residency 2018-2021.',
    },
    scope: {
      claimType,
      covers:
        'Confirms completion of the named residency program with the named source for the stated dates.',
      doesNotCover:
        'Does not confirm board certification, license status, malpractice history, or any other claim.',
      sourceOrganizationName,
    },
    limitations: [],
  };
}
