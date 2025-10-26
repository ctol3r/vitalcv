/**
 * Basic Claim API - Initiates Level 1 claim with email/phone verification
 */

import { NextRequest, NextResponse } from 'next/server';

// Mock PIN store (in production, use Redis or database)
const pinStore = new Map<string, { pin: string; email: string; expires: number }>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { npi, email, phone } = body;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return NextResponse.json({ error: 'Invalid NPI format' }, { status: 400 });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Generate a 6-digit PIN
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Store PIN with 10-minute expiration
    pinStore.set(npi, {
      pin,
      email,
      expires: Date.now() + 10 * 60 * 1000,
    });

    // In production, send email via SendGrid/AWS SES
    console.log(`[Mock Email] PIN for ${email}: ${pin}`);

    // For demo/testing, also log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n🔐 Verification PIN for NPI ${npi}: ${pin}\n`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
    });
  } catch (error) {
    console.error('Basic claim error:', error);
    return NextResponse.json({ error: 'Failed to send verification code' }, { status: 500 });
  }
}
