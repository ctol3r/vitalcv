/**
 * Verify PIN API - Validates email/phone verification PIN
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock PIN store (shared with basic claim route)
// In production, use Redis or database
const pinStore = new Map<string, { pin: string; email: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npi, pin } = body;

    if (!npi || !pin) {
      return NextResponse.json({ error: 'NPI and PIN are required' }, { status: 400 });
    }

    const stored = pinStore.get(npi);

    if (!stored) {
      return NextResponse.json(
        { error: 'No verification request found for this NPI' },
        { status: 404 },
      );
    }

    if (Date.now() > stored.expires) {
      pinStore.delete(npi);
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 },
      );
    }

    if (stored.pin !== pin) {
      return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 });
    }

    // PIN verified successfully
    pinStore.delete(npi);

    // In production, create/update user session here
    // For now, return a mock token
    const token = Buffer.from(`${npi}:${stored.email}:${Date.now()}`).toString('base64');

    return NextResponse.json({
      success: true,
      token,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('PIN verification error:', error);
    return NextResponse.json({ error: 'Failed to verify PIN' }, { status: 500 });
  }
}
