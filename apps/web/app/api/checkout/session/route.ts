import { NextResponse } from 'next/server';
import { resolveCheckoutGate } from '@/lib/commerce/stripeFoundation';

export async function POST(): Promise<NextResponse> {
  const gate = resolveCheckoutGate();

  if (!gate.checkoutLive) {
    return NextResponse.json(
      { error: 'checkout_not_live', collectsPayment: false },
      { status: 503 }
    );
  }

  // Gate is open but Stripe SDK integration is not yet wired.
  // collectsPayment stays false at foundation tier.
  return NextResponse.json(
    { error: 'checkout_not_implemented', collectsPayment: false },
    { status: 503 }
  );
}
