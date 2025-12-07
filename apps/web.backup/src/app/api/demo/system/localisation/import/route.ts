/**
 * API Route: POST /api/demo/system/localisation/import
 *
 * Import translation files (JSON format)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { translations } = body;

    if (!translations || typeof translations !== 'object') {
      return NextResponse.json(
        { error: 'Invalid translations format. Expected object with locale keys.' },
        { status: 400 }
      );
    }

    // Validate structure
    for (const [locale, strings] of Object.entries(translations)) {
      if (typeof strings !== 'object') {
        return NextResponse.json(
          { error: `Invalid format for locale ${locale}. Expected object.` },
          { status: 400 }
        );
      }
    }

    // In production, save to translation database/service
    // For now, just validate and return success
    console.log('Importing translations:', Object.keys(translations).length, 'locales');

    return NextResponse.json({
      success: true,
      importedLocales: Object.keys(translations).length,
      message: 'Translations imported successfully',
    });
  } catch (error) {
    console.error('Error importing translations:', error);
    return NextResponse.json(
      { error: 'Failed to import translations' },
      { status: 500 }
    );
  }
}

