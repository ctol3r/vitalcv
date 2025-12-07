/**
 * API Route: PUT/DELETE /api/demo/org/policy/regional/[id]
 *
 * Update and delete regional policy configurations
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock org ID - in production, get from session/auth
const MOCK_ORG_ID = 'org-123';

// Mock data store - in production, use database
// This would be shared with the parent route in production
let mockPolicies: Array<{
  id: string;
  countryCode: string;
  regionCode: string | null;
  orgId: string | null;
  dataRetentionDays: number;
  requiresExplicitConsent: boolean;
  requiresCookieConsent: boolean;
  allowedDataJurisdictions: string[];
  privacyRules: Record<string, any> | null;
  consentRequirements: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}> = [];

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = request.headers.get('x-org-id') || MOCK_ORG_ID;
    const policyId = params.id;
    const body = await request.json();

    // In production, fetch from database
    const policyIndex = mockPolicies.findIndex((p) => p.id === policyId);
    if (policyIndex === -1) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    const existingPolicy = mockPolicies[policyIndex];
    if (existingPolicy.orgId !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Policy belongs to different organization' },
        { status: 403 }
      );
    }

    // Update policy
    mockPolicies[policyIndex] = {
      ...existingPolicy,
      ...body,
      id: policyId,
      countryCode: existingPolicy.countryCode, // Don't allow changing country/region
      regionCode: existingPolicy.regionCode,
      orgId: existingPolicy.orgId,
      updatedAt: new Date().toISOString(),
    };

    // In production, update in database using regionalSettingsAPI
    // await upsertRegionalPolicyConfig(prisma, orgId, { ...body, countryCode: existingPolicy.countryCode, regionCode: existingPolicy.regionCode });

    return NextResponse.json({ policy: mockPolicies[policyIndex] });
  } catch (error) {
    console.error('Error updating regional policy:', error);
    return NextResponse.json(
      { error: 'Failed to update regional policy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orgId = request.headers.get('x-org-id') || MOCK_ORG_ID;
    const policyId = params.id;

    // In production, fetch from database
    const policyIndex = mockPolicies.findIndex((p) => p.id === policyId);
    if (policyIndex === -1) {
      return NextResponse.json(
        { error: 'Policy not found' },
        { status: 404 }
      );
    }

    const existingPolicy = mockPolicies[policyIndex];
    if (!existingPolicy.orgId) {
      return NextResponse.json(
        { error: 'Cannot delete default policies' },
        { status: 400 }
      );
    }

    if (existingPolicy.orgId !== orgId) {
      return NextResponse.json(
        { error: 'Unauthorized: Policy belongs to different organization' },
        { status: 403 }
      );
    }

    mockPolicies.splice(policyIndex, 1);

    // In production, delete from database using regionalSettingsAPI
    // await deleteRegionalPolicyConfig(prisma, policyId, orgId);

    return NextResponse.json({}, { status: 204 });
  } catch (error) {
    console.error('Error deleting regional policy:', error);
    return NextResponse.json(
      { error: 'Failed to delete regional policy' },
      { status: 500 }
    );
  }
}

