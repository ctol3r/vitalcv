export type AnchorReceipt = {
  chain: string;
  txId: string;
  anchoredAt: string;
};

export interface ChainAdapter {
  anchor(root: string): Promise<AnchorReceipt>;
}

// Stub adapter (replace later)
export class NoopAdapter implements ChainAdapter {
  async anchor(root: string): Promise<AnchorReceipt> {
    return {
      chain: 'NOOP',
      txId: `noop-${root.slice(0, 12)}`,
      anchoredAt: new Date().toISOString(),
    };
  }
}
