/**
 * Wave 196 — Payout Provider Interface
 */

import { log } from '../../obs/logger';

export interface IPayoutProvider {
  schedule(
    recipientId: string,
    amountCents: number,
    memo: string,
  ): Promise<{ id: string }>;
}

class StubPayoutProvider implements IPayoutProvider {
  async schedule(recipientId: string, amountCents: number, memo: string): Promise<{ id: string }> {
    const id = `stub-${Date.now()}`;
    log('info', 'payout_stub_scheduled', { recipientId, amountCents, memo, id });
    return { id };
  }
}

let _provider: IPayoutProvider | null = null;

export function getPayoutProvider(): IPayoutProvider {
  if (_provider) return _provider;
  // TODO: wire Stripe Connect or Trolley when PAYOUT_PROVIDER_KEY is set
  _provider = new StubPayoutProvider();
  return _provider;
}

export function setPayoutProvider(provider: IPayoutProvider): void {
  _provider = provider;
}
