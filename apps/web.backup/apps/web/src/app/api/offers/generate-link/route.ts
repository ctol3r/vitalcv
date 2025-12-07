/**
 * POST /api/offers/generate-link
 * Phase 2: Generate DPoP-signed URL for offer delivery
 */

import { NextRequest, NextResponse } from 'next/server';
import type { OfferLink } from '@/lib/offers/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerId, method } = body;

    if (!offerId || !method) {
      return NextResponse.json(
        { error: 'Missing offerId or method' },
        { status: 400 }
      );
    }

    // TODO: Verify DPoP token
    // const dpopToken = request.headers.get('authorization')?.replace('DPoP ', '');
    // if (!dpopToken) {
    //   return NextResponse.json({ error: 'DPoP token required' }, { status: 401 });
    // }

    // Generate signed URL (stub - in production, use actual DPoP signing)
    const token = `offer_${offerId}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const signedUrl = `${baseUrl}/offers/${offerId}?token=${token}`;

    // Calculate expiration (48 hours default)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    // Generate QR code if method is 'qr' (stub - in production, use actual QR generation)
    let qrCodeDataUrl: string | undefined;
    if (method === 'qr') {
      // TODO: Generate actual QR code using a library like 'qrcode'
      // For now, return a placeholder
      qrCodeDataUrl = `data:image/svg+xml;base64,${Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="white"/><text x="128" y="128" text-anchor="middle" font-size="12">QR Code Placeholder</text></svg>`
      ).toString('base64')}`;
    }

    const link: OfferLink = {
      offerId,
      signedUrl,
      expiresAt: expiresAt.toISOString(),
      dpopToken: token,
      qrCodeDataUrl,
    };

    return NextResponse.json(link);
  } catch (error) {
    console.error('Failed to generate offer link:', error);
    return NextResponse.json(
      { error: 'Failed to generate offer link' },
      { status: 500 }
    );
  }
}

