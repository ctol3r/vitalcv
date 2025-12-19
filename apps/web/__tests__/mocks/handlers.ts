import { http, HttpResponse } from 'msw';

export const handlers = [
  // Verification API
  http.post('/api/verifier/presentation', async ({ request }) => {
    const body = (await request.json()) as any;
    const { credentialId, privacyMode, disclosureType } = body;

    if (credentialId.includes('revoked')) {
      return HttpResponse.json({
        status: 'revoked',
        credentialId,
        auditRef: `AUDIT-${Date.now()}`,
        details: {
          issuer: 'California Medical Board',
          issuedDate: '2023-01-15',
          expiryDate: '2025-01-15',
          reason: 'License suspended due to administrative review',
        },
      });
    }

    if (credentialId.includes('unknown')) {
      return HttpResponse.json({
        status: 'unknown',
        credentialId,
        auditRef: `AUDIT-${Date.now()}`,
        details: {
          reason: 'Credential not found in registry',
        },
      });
    }

    return HttpResponse.json({
      status: 'valid',
      credentialId,
      auditRef: `AUDIT-${Date.now()}`,
      details: {
        issuer: 'California Medical Board',
        issuedDate: '2023-01-15',
        expiryDate: '2025-01-15',
        disclosureType:
          disclosureType === 'plain'
            ? 'Full disclosure'
            : disclosureType === 'bbs'
            ? 'BBS+ selective disclosure'
            : 'Zero-knowledge proof',
      },
    });
  }),

  // VP Token generation
  http.post('/api/verifier/vp-token', async () => {
    return HttpResponse.json({
      vpToken:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    });
  }),

  // Share URL generation
  http.post('/api/share/one-time-url', async () => {
    return HttpResponse.json({
      shareUrl: 'https://vitalcv.com/share/abc123def456',
    });
  }),

  http.get('/api/issuer/credentials', async () => {
    return HttpResponse.json({
      credentials: [
        {
          id: 'CRED-12345',
          type: 'Medical License',
          holder: { name: 'Dr. Sarah Johnson', email: 'sarah@example.com' },
          status: 'active',
          issuedDate: '2023-01-15',
          expiryDate: '2025-01-15',
        },
        {
          id: 'CRED-67890',
          type: 'Nursing License',
          holder: { name: 'Jane Smith', email: 'jane@example.com' },
          status: 'active',
          issuedDate: '2023-02-20',
          expiryDate: '2025-02-20',
        },
      ],
    });
  }),

  // Issuer credential creation
  http.post('/api/issuer/credential', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      credentialId: `CRED-${Date.now()}`,
      status: 'issued',
      message: 'Credential issued successfully',
    });
  }),

  // Credential revocation
  http.post('/api/status/revoke', async ({ request }) => {
    const body = (await request.json()) as any;
    return HttpResponse.json({
      credentialId: body.credentialId,
      status: 'revoked',
      message: 'Credential revoked successfully',
    });
  }),

  // New credential status endpoint
  http.get('/api/verifier/credential/:id/status', async ({ params }) => {
    const credentialId = params.id as string;

    if (credentialId.includes('revoked')) {
      return HttpResponse.json({
        status: 'revoked',
        credentialId,
        auditRef: `AUDIT-${Date.now()}`,
        details: {
          issuer: 'California Medical Board',
          issuedDate: '2023-01-15',
          expiryDate: '2025-01-15',
          reason: 'License suspended due to administrative review',
        },
      });
    }

    if (credentialId.includes('unknown')) {
      return HttpResponse.json({
        status: 'unknown',
        credentialId,
        auditRef: `AUDIT-${Date.now()}`,
        details: {
          reason: 'Credential not found in registry',
        },
      });
    }

    return HttpResponse.json({
      status: 'valid',
      credentialId,
      auditRef: `AUDIT-${Date.now()}`,
      details: {
        issuer: 'California Medical Board',
        issuedDate: '2023-01-15',
        expiryDate: '2025-01-15',
      },
    });
  }),

  http.get('/api/reports/:id', async ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      timestamp: '2024-01-15T10:30:00Z',
      status: 'completed',
      recommendation: 'proceed',
      clearedCredentials: [
        {
          id: 'CRED-12345',
          type: 'Medical License',
          holder: 'Dr. Sarah Johnson',
          status: 'valid',
          verifiedAt: '2024-01-15T10:25:00Z',
        },
      ],
      pendingCredentials: [
        {
          id: 'CRED-67890',
          type: 'DEA Registration',
          holder: 'Dr. Sarah Johnson',
          status: 'pending_verification',
          reason: 'Awaiting external verification',
        },
      ],
      fhirBundleAvailable: true,
      fhirVersion: 'R4',
      resourceTypes: ['Practitioner'],
    });
  }),

  // Analytics data
  http.get('/api/analytics', async ({ request }) => {
    const url = new URL(request.url);
    const timeRange = url.searchParams.get('timeRange');

    return HttpResponse.json({
      metrics: {
        confidenceScore: 94,
        fraudAlerts: 3,
        successRate: 98.2,
        totalVerifications: 1247,
        avgVerificationTime: 2.3,
        activeCredentials: 892,
        revocationRate: 1.8,
        p50VerificationTime: 1.8,
        p95VerificationTime: 4.2,
      },
      trends: {
        successRate: [
          { name: 'Week 1', value: 97.5 },
          { name: 'Week 2', value: 98.1 },
          { name: 'Week 3', value: 97.8 },
          { name: 'Week 4', value: 98.2 },
        ],
        revocations: [
          { name: 'Week 1', value: 5 },
          { name: 'Week 2', value: 3 },
          { name: 'Week 3', value: 7 },
          { name: 'Week 4', value: 4 },
        ],
        verificationTimes: [
          { name: 'Week 1', p50: 2.1, p95: 4.8 },
          { name: 'Week 2', p50: 1.9, p95: 4.2 },
          { name: 'Week 3', p50: 1.7, p95: 3.9 },
          { name: 'Week 4', p50: 1.8, p95: 4.2 },
        ],
        volumeTrends: [
          { name: 'Jan', value: 850 },
          { name: 'Feb', value: 920 },
          { name: 'Mar', value: 1100 },
          { name: 'Apr', value: 1247 },
        ],
      },
      recentAlerts: [
        {
          id: 1,
          type: 'fraud',
          message: 'Suspicious credential pattern detected in CRED-99887',
          timestamp: '2 hours ago',
          severity: 'high',
        },
      ],
    });
  }),

  // FHIR Bundle download
  http.get('/api/reports/:id/fhir-bundle', async ({ params }) => {
    const fhirBundle = {
      resourceType: 'Bundle',
      id: params.id,
      type: 'collection',
      timestamp: new Date().toISOString(),
      entry: [
        {
          resource: {
            resourceType: 'Practitioner',
            id: 'practitioner-1',
            name: [{ family: 'Johnson', given: ['Sarah'] }],
            qualification: [
              {
                code: {
                  coding: [
                    {
                      system: 'http://terminology.hl7.org/CodeSystem/v2-0360',
                      code: 'MD',
                      display: 'Medical License',
                    },
                  ],
                },
                issuer: { display: 'California Medical Board' },
              },
            ],
          },
        },
      ],
    };

    return HttpResponse.json(fhirBundle, {
      headers: {
        'Content-Type': 'application/fhir+json',
        'Content-Disposition': `attachment; filename="fhir-bundle-${params.id}.json"`,
      },
    });
  }),

  http.get('*/healthz', async () => {
    return HttpResponse.json({ status: 'healthy' });
  }),

  http.get('*/readyz', async () => {
    return HttpResponse.json({ status: 'ready' });
  }),

  // CV Upload endpoint
  http.post('/api/upload/cv', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('cv') as File;

    if (!file) {
      return HttpResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Simulate file processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock parsed CV data
    return HttpResponse.json({
      parsedData: {
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@example.com',
        phone: '555-0123',
        specialty: 'Internal Medicine',
        experience: '10 years',
        education: [
          'MD from Stanford University School of Medicine',
          'Residency at UCSF Medical Center',
        ],
        certifications: [
          'Board Certified in Internal Medicine',
          'Advanced Cardiac Life Support (ACLS)',
        ],
      },
    });
  }),

  // NPI Sync endpoint
  http.post('/api/clinician/npi-sync', async ({ request }) => {
    const body = (await request.json()) as any;
    const { npi } = body;

    if (!npi || npi.length !== 10) {
      return HttpResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
    }

    // Simulate NPI lookup delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock NPI data
    return HttpResponse.json({
      name: 'Dr. Sarah Johnson',
      specialty: 'Internal Medicine',
      address: '123 Medical Plaza, San Francisco, CA 94102',
      licenses: ['CA Medical License #A12345', 'DEA Registration #AB1234567'],
      npiType: 'Individual',
      taxonomyCode: '207R00000X',
      taxonomyDescription: 'Internal Medicine',
    });
  }),

  // Dashboard data endpoint for clinician dashboard
  http.get('/api/dashboard/clinician', async () => {
    return HttpResponse.json({
      clinician: {
        npi: '1234567890',
        name: 'Dr. Sarah Johnson',
        specialty: 'Internal Medicine',
        address: '123 Medical Plaza, San Francisco, CA 94102',
        licenses: ['CA Medical License #A12345', 'DEA Registration #AB1234567'],
        npiType: 'Individual',
        taxonomyCode: '207R00000X',
        taxonomyDescription: 'Internal Medicine',
        lastSynced: '2024-01-15T10:30:00Z',
      },
      licenses: [
        {
          state: 'California',
          number: 'A12345',
          status: 'active',
          expiration: '2025-12-31',
          verified: true,
        },
        {
          state: 'Nevada',
          number: 'NV98765',
          status: 'expiring_soon',
          expiration: '2024-03-15',
          verified: true,
        },
        {
          state: 'Arizona',
          number: 'AZ54321',
          status: 'expired',
          expiration: '2023-11-30',
          verified: false,
        },
      ],
      notifications: [
        {
          id: 1,
          type: 'warning',
          message: 'Nevada medical license expires in 45 days',
          timestamp: '2 hours ago',
          actionRequired: true,
        },
        {
          id: 2,
          type: 'update',
          message: 'Updated information detected in NPPES registry',
          timestamp: '1 day ago',
          actionRequired: true,
        },
        {
          id: 3,
          type: 'info',
          message: 'Profile verification completed successfully',
          timestamp: '3 days ago',
          actionRequired: false,
        },
      ],
    });
  }),

  // Profile data endpoint for comprehensive clinician profiles
  http.get('/api/profile/:id', async ({ params }) => {
    const profileId = params.id as string;

    return HttpResponse.json({
      profile: {
        npi: profileId,
        name: 'Dr. Sarah Johnson',
        specialty: 'Internal Medicine',
        location: 'San Francisco, CA',
        address: '123 Medical Plaza, San Francisco, CA 94102',
        npiType: 'Individual',
        taxonomyCode: '207R00000X',
        taxonomyDescription: 'Internal Medicine',
        lastSynced: '2024-01-15T10:30:00Z',
        education: [
          {
            degree: 'Doctor of Medicine (MD)',
            institution: 'Stanford University School of Medicine',
            year: '2010',
            details: 'Magna Cum Laude, Alpha Omega Alpha Honor Society',
          },
          {
            degree: 'Bachelor of Science in Biology',
            institution: 'University of California, Berkeley',
            year: '2006',
            details: 'Summa Cum Laude, Phi Beta Kappa',
          },
        ],
        experience: [
          {
            position: 'Attending Physician, Internal Medicine',
            organization: 'UCSF Medical Center',
            startDate: '2014-07-01',
            description:
              'Primary care and hospital medicine, supervising residents and medical students',
          },
          {
            position: 'Chief Resident, Internal Medicine',
            organization: 'UCSF Medical Center',
            startDate: '2013-07-01',
            endDate: '2014-06-30',
            description: 'Leadership role overseeing resident education and clinical operations',
          },
        ],
        licenses: [
          {
            state: 'California',
            number: 'A12345',
            status: 'active',
            expiration: '2025-12-31',
            verified: true,
          },
          {
            state: 'Nevada',
            number: 'NV98765',
            status: 'expiring_soon',
            expiration: '2024-03-15',
            verified: true,
          },
        ],
        certifications: [
          {
            name: 'Board Certification in Internal Medicine',
            issuer: 'American Board of Internal Medicine',
            issueDate: '2014-01-15',
            expirationDate: '2024-12-31',
            credentialId: 'ABIM-12345',
          },
          {
            name: 'Advanced Cardiac Life Support (ACLS)',
            issuer: 'American Heart Association',
            issueDate: '2023-06-01',
            expirationDate: '2025-06-01',
            credentialId: 'AHA-ACLS-67890',
          },
        ],
      },
    });
  }),
];
