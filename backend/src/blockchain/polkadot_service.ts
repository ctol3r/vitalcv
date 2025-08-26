import { ApiPromise, WsProvider, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';

/**
 * Service wrapping Polkadot-js API interactions.
 */
export class PolkadotService {
  private api: ApiPromise | null = null;

  /** Connect to a chain endpoint using WebSockets. */
  async connect(endpoint: string): Promise<void> {
    const provider = new WsProvider(endpoint);
    this.api = await ApiPromise.create({ provider });
  }

  /** Issue a credential to a destination account. */
  async issueCredential(
    signer: KeyringPair,
    dest: string,
    data: string
  ): Promise<SubmittableResult> {
    if (!this.api) {
      throw new Error('API not connected');
    }
    const tx = this.api.tx.credentialsModule.issueCredential(dest, data);
    return tx.signAndSend(signer);
  }

  /**
   * Batch multiple credential issuance calls into a single extrinsic using
   * the utility.batch function.
   */
  async batchIssueCredentials(
    signer: KeyringPair,
    destinations: string[],
    data: string[]
  ): Promise<SubmittableResult> {
    if (!this.api) {
      throw new Error('API not connected');
    }
    if (destinations.length !== data.length) {
      throw new Error('Array lengths must match');
    }
    const calls = destinations.map((dest, i) =>
      this.api!.tx.credentialsModule.issueCredential(dest, data[i])
    );
    const batch = this.api.tx.utility.batch(calls);
    return batch.signAndSend(signer);
  }
}
