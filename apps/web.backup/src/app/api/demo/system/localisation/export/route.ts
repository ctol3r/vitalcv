/**
 * API Route: GET /api/demo/system/localisation/export
 *
 * Export translation files (JSON format)
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock translation data - in production, fetch from translation database
const MOCK_TRANSLATIONS: Record<string, Record<string, string>> = {
  'en-US': {
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'settings.language': 'Language',
    'settings.timezone': 'Time Zone',
    'settings.currency': 'Currency',
  },
  'es-ES': {
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'settings.language': 'Idioma',
    'settings.timezone': 'Zona Horaria',
    'settings.currency': 'Moneda',
  },
};

export async function GET(request: NextRequest) {
  try {
    const locale = request.nextUrl.searchParams.get('locale');

    let translations: Record<string, Record<string, string>>;
    if (locale && MOCK_TRANSLATIONS[locale]) {
      translations = { [locale]: MOCK_TRANSLATIONS[locale] };
    } else {
      translations = MOCK_TRANSLATIONS;
    }

    const json = JSON.stringify(translations, null, 2);

    return new NextResponse(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="translations${locale ? `-${locale}` : '-all'}-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting translations:', error);
    return NextResponse.json(
      { error: 'Failed to export translations' },
      { status: 500 }
    );
  }
}

