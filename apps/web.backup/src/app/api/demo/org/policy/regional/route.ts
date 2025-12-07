/**
 * API Route: GET/POST /api/demo/org/policy/regional
 *
 * Get and create regional policy configurations for organization
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock org ID - in production, get from session/auth
const MOCK_ORG_ID = 'org-123';

// Mock data store - in production, use database
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

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || request.nextUrl.searchParams.get('orgId') || MOCK_ORG_ID;
    const countryCode = request.nextUrl.searchParams.get('countryCode') || undefined;
    const regionCode = request.nextUrl.searchParams.get('regionCode') || undefined;

    // In production, fetch from database using regionalSettingsAPI
    // For now, return mock data
    let filtered = mockPolicies.filter((p) => {
      if (p.orgId !== orgId && p.orgId !== null) return false;
      if (countryCode && p.countryCode !== countryCode) return false;
      if (regionCode !== undefined && p.regionCode !== regionCode) return false;
      return true;
    });

    // If no org-specific policies, return defaults
    if (filtered.length === 0) {
      filtered = [
        {
          id: 'default-us',
          countryCode: 'US',
          regionCode: null,
          orgId: null,
          dataRetentionDays: 2555,
          requiresExplicitConsent: true,
          requiresCookieConsent: true,
          allowedDataJurisdictions: ['US'],
          privacyRules: null,
          consentRequirements: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    }

    return NextResponse.json({ policies: filtered });
  } catch (error) {
    console.error('Error fetching regional policies:', error);
    return NextResponse.json(
      { error: 'Failed to fetch regional policies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || MOCK_ORG_ID;
    const body = await request.json();

    const {
      countryCode,
      regionCode,
      dataRetentionDays,
      requiresExplicitConsent,
      requiresCookieConsent,
      allowedDataJurisdictions,
      privacyRules,
      consentRequirements,
    } = body;

    if (!countryCode || countryCode.length !== 2) {
      return NextResponse.json(
        { error: 'Invalid country code. Use 2-letter ISO code like "US"' },
        { status: 400 }
      );
    }

    const newPolicy = {
      id: `policy-${Date.now()}`,
      countryCode,
      regionCode: regionCode || null,
      orgId,
      dataRetentionDays: dataRetentionDays || 2555,
      requiresExplicitConsent: requiresExplicitConsent ?? true,
      requiresCookieConsent: requiresCookieConsent ?? true,
      allowedDataJurisdictions: allowedDataJurisdictions || [],
      privacyRules: privacyRules || null,
      consentRequirements: consentRequirements || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    mockPolicies.push(newPolicy);

    // In production, save to database using regionalSettingsAPI
    // await upsertRegionalPolicyConfig(prisma, orgId, body);

    return NextResponse.json({ policy: newPolicy }, { status: 201 });
  } catch (error) {
    console.error('Error creating regional policy:', error);
    return NextResponse.json(
      { error: 'Failed to create regional policy' },
      { status: 500 }
    );
  }
}

