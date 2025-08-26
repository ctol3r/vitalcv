import { ApiPromise, WsProvider, SubmittableResult } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { KeyRotationPolicy } from './key_rotation_policy';

export interface AuditRecord {
  userId: string;
  action: string;
  timestamp: number;
}

/**
 * Service wrapping Polkadot-js API interactions.
 */
export class PolkadotService {
  private api: ApiPromise | null = null;
  private keyPolicy: KeyRotationPolicy;

  constructor(initialKey?: string) {
    this.keyPolicy = new KeyRotationPolicy(initialKey || 'default-key');
  }

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

  /** Store audit record on-chain for immutable tracking. */
  async storeAuditRecord(record: AuditRecord): Promise<void> {
    // This is a placeholder for the actual interaction with the Polkadot
    // blockchain which would store a hash of the audit data.
    console.log('Storing record on-chain:', record);
  }

  /**
   * Schedule rotation of the signing key used for transactions.
   */
  scheduleKeyRotation(newKey: string, transitionTime: number): void {
    this.keyPolicy.scheduleRotation(newKey, transitionTime);
  }

  /**
   * Retrieve the key that should be used for signing at the given time.
   */
  getSigningKey(currentTime: number = Date.now()): string {
    return this.keyPolicy.getActiveKey(currentTime);
  }
}
