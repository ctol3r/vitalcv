/**
 * API Route: GET /api/demo/user/agreements
 *
 * Get user agreements, privacy notices, and region-specific documents
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock agreement data - in production, fetch from database
function getMockAgreements(language: string): Array<{
  id: string;
  type: 'terms' | 'privacy' | 'region_specific';
  title: string;
  version: string;
  effectiveDate: string;
  language: string;
  content: string;
  pdfUrl?: string;
  regionCode?: string;
  countryCode?: string;
}> {
  const isSpanish = language.startsWith('es');
  const isFrench = language.startsWith('fr');

  return [
    {
      id: 'terms-1',
      type: 'terms',
      title: isSpanish
        ? 'Términos de Servicio'
        : isFrench
        ? "Conditions d'utilisation"
        : 'Terms of Service',
      version: '2.1',
      effectiveDate: new Date('2024-01-01').toISOString(),
      language,
      content: isSpanish
        ? '<h1>Términos de Servicio</h1><p>Estos son los términos de servicio...</p>'
        : isFrench
        ? "<h1>Conditions d'utilisation</h1><p>Voici les conditions d'utilisation...</p>"
        : '<h1>Terms of Service</h1><p>These are the terms of service...</p>',
      pdfUrl: `/api/demo/user/agreements/terms-1/pdf?language=${language}`,
    },
    {
      id: 'privacy-1',
      type: 'privacy',
      title: isSpanish
        ? 'Política de Privacidad'
        : isFrench
        ? 'Politique de Confidentialité'
        : 'Privacy Policy',
      version: '3.0',
      effectiveDate: new Date('2024-03-15').toISOString(),
      language,
      content: isSpanish
        ? '<h1>Política de Privacidad</h1><p>Esta es la política de privacidad...</p>'
        : isFrench
        ? '<h1>Politique de Confidentialité</h1><p>Voici la politique de confidentialité...</p>'
        : '<h1>Privacy Policy</h1><p>This is the privacy policy...</p>',
      pdfUrl: `/api/demo/user/agreements/privacy-1/pdf?language=${language}`,
    },
    {
      id: 'gdpr-1',
      type: 'region_specific',
      title: isSpanish
        ? 'Aviso GDPR'
        : isFrench
        ? 'Avis GDPR'
        : 'GDPR Notice',
      version: '1.0',
      effectiveDate: new Date('2024-01-01').toISOString(),
      language,
      content: isSpanish
        ? '<h1>Aviso GDPR</h1><p>Este es el aviso GDPR...</p>'
        : isFrench
        ? '<h1>Avis GDPR</h1><p>Voici l\'avis GDPR...</p>'
        : '<h1>GDPR Notice</h1><p>This is the GDPR notice...</p>',
      pdfUrl: `/api/demo/user/agreements/gdpr-1/pdf?language=${language}`,
      regionCode: 'EU',
      countryCode: 'EU',
    },
  ];
}

function getMockVersions(): Record<string, Array<{
  version: string;
  effectiveDate: string;
  language: string;
  pdfUrl?: string;
}>> {
  return {
    'terms-1': [
      {
        version: '2.1',
        effectiveDate: new Date('2024-01-01').toISOString(),
        language: 'en-US',
        pdfUrl: '/api/demo/user/agreements/terms-1/pdf?version=2.1',
      },
      {
        version: '2.0',
        effectiveDate: new Date('2023-06-01').toISOString(),
        language: 'en-US',
        pdfUrl: '/api/demo/user/agreements/terms-1/pdf?version=2.0',
      },
    ],
    'privacy-1': [
      {
        version: '3.0',
        effectiveDate: new Date('2024-03-15').toISOString(),
        language: 'en-US',
        pdfUrl: '/api/demo/user/agreements/privacy-1/pdf?version=3.0',
      },
      {
        version: '2.5',
        effectiveDate: new Date('2023-12-01').toISOString(),
        language: 'en-US',
        pdfUrl: '/api/demo/user/agreements/privacy-1/pdf?version=2.5',
      },
    ],
  };
}

export async function GET(request: NextRequest) {
  try {
    const language = request.nextUrl.searchParams.get('language') || 'en-US';
    const userId = request.nextUrl.searchParams.get('userId');

    // In production, fetch from database based on user's region and language
    const documents = getMockAgreements(language);
    const versions = getMockVersions();

    return NextResponse.json({
      documents,
      versions,
    });
  } catch (error) {
    console.error('Error fetching agreements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agreements' },
      { status: 500 }
    );
  }
}

