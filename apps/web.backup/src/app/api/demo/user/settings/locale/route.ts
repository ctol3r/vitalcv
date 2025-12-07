/**
 * API Route: GET/PUT /api/demo/user/settings/locale
 *
 * Get and update user locale preferences (language, timezone, currency)
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock user ID - in production, get from session/auth
const MOCK_USER_ID = 'user-123';

// Mock data store - in production, use database
let mockPreferences: {
  language: string;
  timezone: string;
  currency: string;
} = {
  language: 'en-US',
  timezone: 'UTC',
  currency: 'USD',
};

export async function GET(request: NextRequest) {
  try {
    // In production, get userId from session/auth token
    const userId = request.headers.get('x-user-id') || MOCK_USER_ID;

    // In production, fetch from database using regionalSettingsAPI
    // For now, return mock data
    return NextResponse.json({
      language: mockPreferences.language,
      timezone: mockPreferences.timezone,
      currency: mockPreferences.currency,
    });
  } catch (error) {
    console.error('Error fetching locale preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locale preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || MOCK_USER_ID;
    const body = await request.json();

    // Validate input
    const { language, timezone, currency } = body;

    if (language && !/^[a-z]{2}-[A-Z]{2}$/.test(language)) {
      return NextResponse.json(
        { error: 'Invalid language format. Use format like "en-US"' },
        { status: 400 }
      );
    }

    if (currency && currency.length !== 3) {
      return NextResponse.json(
        { error: 'Invalid currency format. Use 3-letter ISO code like "USD"' },
        { status: 400 }
      );
    }

    // Update preferences
    if (language) mockPreferences.language = language;
    if (timezone) mockPreferences.timezone = timezone;
    if (currency) mockPreferences.currency = currency;

    // In production, save to database using regionalSettingsAPI
    // await updateUserLocalePreferences(prisma, userId, { language, timezone, currency });

    return NextResponse.json(mockPreferences);
  } catch (error) {
    console.error('Error updating locale preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update locale preferences' },
      { status: 500 }
    );
  }
}

