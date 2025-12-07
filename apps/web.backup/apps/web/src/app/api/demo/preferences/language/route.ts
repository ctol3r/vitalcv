import { NextResponse } from 'next/server';

const preferenceStore = new Map<string, string>();

export async function POST(request: Request) {
  const { locale, userId } = (await request.json()) as {
    locale?: string;
    userId?: string;
  };

  if (!locale) {
    return NextResponse.json(
      { success: false, message: 'locale is required' },
      { status: 400 },
    );
  }

  if (userId) {
    preferenceStore.set(userId, locale);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('vitalcv_locale', locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}










