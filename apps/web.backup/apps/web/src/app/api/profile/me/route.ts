/**
 * Profile API Route
 * GET /api/profile/me - Returns the current clinician's profile
 */

import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export interface ClinicianProfile {
  clinicianId: string;
  did: string;
  name: string;
  avatarUrl?: string;
  specialty: string;
  city?: string;
  state?: string;
  organization?: string;
  trustScore: number;
  didTrustHealth: number; // 0-1 scale
  yearsPracticing: number;
  activeLicenses: number;
  boardCertifications: Array<{
    name: string;
    issuer: string;
    issuedDate: string;
    expirationDate?: string;
    verified: boolean;
  }>;
  compliance: {
    dea: 'active' | 'expired' | 'none';
    npdb: 'clear' | 'flagged' | 'unknown';
    sanctions: boolean;
  };
  credentialStrength: number; // 0-1 scale
  roleReadiness: {
    score: number;
    matches: Array<{
      jobId: string;
      jobTitle: string;
      matchScore: number;
    }>;
  };
  experience: Array<{
    id: string;
    type: 'education' | 'residency' | 'fellowship' | 'employment' | 'certification' | 'credential' | 'chain_anchor';
    title: string;
    organization?: string;
    startDate: string;
    endDate?: string;
    description?: string;
    verified: boolean;
    chainAnchored?: boolean;
    trustScore?: number;
  }>;
  skills: Array<{
    name: string;
    category: string;
    verified: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export async function GET() {
  try {
    // In a real implementation, this would fetch from the backend
    // For now, we'll return mock data that matches the expected structure
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '');

    if (base) {
      try {
        const response = await fetch(`${base.replace(/\/$/, '')}/api/profile/me`, {
          cache: 'no-store',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }
      } catch (error) {
        console.warn('[profile][api] Backend fetch failed, using mock data', error);
      }
    }

    // Mock profile data for development
    const mockProfile: ClinicianProfile = {
      clinicianId: 'cln_demo_12345',
      did: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      name: 'Dr. Sarah Johnson',
      specialty: 'Family Medicine',
      city: 'San Francisco',
      state: 'CA',
      organization: 'UCSF Medical Center',
      trustScore: 0.92,
      didTrustHealth: 0.88,
      yearsPracticing: 14,
      activeLicenses: 3,
      boardCertifications: [
        {
          name: 'Board Certification in Family Medicine',
          issuer: 'American Board of Family Medicine',
          issuedDate: '2014-01-15',
          expirationDate: '2024-12-31',
          verified: true,
        },
      ],
      compliance: {
        dea: 'active',
        npdb: 'clear',
        sanctions: false,
      },
      credentialStrength: 0.89,
      roleReadiness: {
        score: 0.91,
        matches: [
          {
            jobId: 'job_001',
            jobTitle: 'Family Medicine Physician',
            matchScore: 0.95,
          },
        ],
      },
      experience: [
        {
          id: 'exp_001',
          type: 'education',
          title: 'Doctor of Medicine (MD)',
          organization: 'Stanford University School of Medicine',
          startDate: '2006-09-01',
          endDate: '2010-06-01',
          verified: true,
          chainAnchored: true,
          trustScore: 0.95,
        },
        {
          id: 'exp_002',
          type: 'residency',
          title: 'Family Medicine Residency',
          organization: 'UCSF Medical Center',
          startDate: '2010-07-01',
          endDate: '2013-06-30',
          verified: true,
          chainAnchored: true,
          trustScore: 0.93,
        },
        {
          id: 'exp_003',
          type: 'employment',
          title: 'Attending Physician',
          organization: 'UCSF Medical Center',
          startDate: '2013-07-01',
          verified: true,
          chainAnchored: true,
          trustScore: 0.92,
        },
        {
          id: 'exp_004',
          type: 'certification',
          title: 'Board Certification in Family Medicine',
          organization: 'American Board of Family Medicine',
          startDate: '2014-01-15',
          verified: true,
          chainAnchored: true,
          trustScore: 0.94,
        },
      ],
      skills: [
        { name: 'Primary Care', category: 'Clinical', verified: true },
        { name: 'Preventive Medicine', category: 'Clinical', verified: true },
        { name: 'Chronic Disease Management', category: 'Clinical', verified: true },
      ],
      createdAt: '2010-01-01T00:00:00Z',
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json(mockProfile);
  } catch (error) {
    console.error('[profile][api] Error fetching profile', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}








