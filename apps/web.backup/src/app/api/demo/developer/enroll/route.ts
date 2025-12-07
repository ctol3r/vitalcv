/**
 * API route for developer enrollment
 * Creates a developer account and generates an API key
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.organizationName || !body.contactEmail || !body.contactName || !body.useCase) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate API key (in production, use the APIKeyManagementService)
    const apiKey = `sk_live_${crypto.randomBytes(32).toString('base64url')}`;

    // In production, this would:
    // 1. Create developer account in database
    // 2. Generate API key using APIKeyManagementService
    // 3. Send welcome email
    // 4. Log enrollment event

    // For demo purposes, return the API key
    return NextResponse.json({
      success: true,
      apiKey,
      message: 'Developer account created successfully',
    });
  } catch (error) {
    console.error('Enrollment error:', error);
    return NextResponse.json(
      { error: 'Failed to process enrollment' },
      { status: 500 }
    );
  }
}

