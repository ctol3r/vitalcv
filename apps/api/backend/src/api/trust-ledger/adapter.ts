export interface AnchorReceipt {
  root: string;
  leafCount: number;
  anchoredAt: string;
  adapter: string;
  txId?: string;
  network?: string;
  metadata?: Record<string, unknown>;
}

export interface ChainAdapter {
  name: string;
  anchorRoot(root: string, options: { leafCount: number }): Promise<AnchorReceipt>;
}

export class NoopAdapter implements ChainAdapter {
  name = 'noop';

  async anchorRoot(root: string, options: { leafCount: number }): Promise<AnchorReceipt> {
    return {
      root,
      leafCount: options.leafCount,
      adapter: this.name,
      anchoredAt: new Date().toISOString(),
      txId: 'noop',
      network: 'off-chain',
      metadata: { note: 'No-op adapter; persistence only, no chain selected.' },
    };
  }
}
