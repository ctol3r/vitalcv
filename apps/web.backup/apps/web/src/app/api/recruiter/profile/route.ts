/**
 * Recruiter Profile API Route
 * Phase 1: Foundation & Navigation
 *
 * Returns recruiter profile and permissions from backend
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // In production, this would fetch from the backend API
    // For now, return a mock response
    const profile = {
      recruiterId: 'recruiter-123',
      email: 'recruiter@example.com',
      name: 'Recruiter User',
      organizationId: 'org-456',
      organizationName: 'Healthcare Staffing Agency',
      permissions: {
        canViewCandidates: true,
        canVerifyCredentials: true,
        canMatchJobs: true,
        canSharePackets: true,
        canAccessAnalytics: true,
        readOnlyFields: [],
        allowedActions: ['view', 'verify', 'match', 'share', 'analytics'],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(profile);
  } catch (error) {
    console.error('Failed to fetch recruiter profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recruiter profile' },
      { status: 500 }
    );
  }
}




