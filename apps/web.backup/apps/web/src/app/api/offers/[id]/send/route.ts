/**
 * POST /api/offers/[id]/send
 * Phase 2: Send offer via selected delivery method
 */

import { NextRequest, NextResponse } from 'next/server';
import type { OfferNotification } from '@/lib/offers/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const offerId = params.id;
    const body = await request.json();
    const { method, link } = body;

    if (!method) {
      return NextResponse.json(
        { error: 'Missing delivery method' },
        { status: 400 }
      );
    }

    // TODO: Verify DPoP token
    // const dpopToken = request.headers.get('authorization')?.replace('DPoP ', '');
    // if (!dpopToken) {
    //   return NextResponse.json({ error: 'DPoP token required' }, { status: 401 });
    // }

    // TODO: Fetch offer from database
    // const offer = await db.offer.findUnique({ where: { id: offerId } });
    // if (!offer) {
    //   return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    // }

    // Update offer status
    // await db.offer.update({
    //   where: { id: offerId },
    //   data: {
    //     status: 'sent',
    //     sentAt: new Date(),
    //     deliveryMethod: method,
    //   },
    // });

    // Create notification
    const notification: OfferNotification = {
      offerId,
      recipientId: 'clinician-id', // TODO: Get from offer
      channel: method === 'email' ? 'email' : method === 'in-app' ? 'in-app' : 'push',
      payload: {
        title: 'New Job Offer',
        body: `You have received a new job offer`,
        offerId,
        deepLink: link,
      },
      sentAt: new Date().toISOString(),
    };

    // TODO: Send notification via appropriate channel
    // if (method === 'email') {
    //   await sendEmailNotification(notification);
    // } else if (method === 'in-app') {
    //   await sendInAppNotification(notification);
    // }

    // TODO: Log audit event to chain
    // await logAuditEvent({
    //   eventType: 'OFFER_SENT',
    //   offerId,
    //   method,
    //   metadata: { link },
    // });

    // TODO: Create tracking event
    // await db.offerTrackingEvent.create({
    //   data: {
    //     offerId,
    //     event: 'sent',
    //     timestamp: new Date(),
    //   },
    // });

    return NextResponse.json({
      success: true,
      notification,
      message: 'Offer sent successfully',
    });
  } catch (error) {
    console.error('Failed to send offer:', error);
    return NextResponse.json(
      { error: 'Failed to send offer' },
      { status: 500 }
    );
  }
}

