import { ApiPromise, SubmittableExtrinsic } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

export interface ChaiCredentialMessage {
  credentialId: string;
  payload: string;
}

/**
 * XcmHandler provides helper utilities for parachains to send and
 * receive CHAI credential messages via XCM. The implementation is
 * intentionally lightweight and can be integrated into an existing
 * service that already initialises an ApiPromise instance.
 */
export class XcmHandler {
  constructor(private api: ApiPromise) {}

  /**
   * Sends a CHAI credential message to another parachain using a
   * remark-based XCM. This example uses a simple remark extrinsic but
   * can be replaced with a more sophisticated XCM format.
   */
  async sendCredential(destParaId: number, message: ChaiCredentialMessage, signerSeed: string): Promise<void> {
    const keyring = new Keyring({ type: 'sr25519' });
    const signer = keyring.addFromUri(signerSeed);

    // Construct a remark payload that other parachains can parse.
    const remark = `CHAI:${destParaId}:${JSON.stringify(message)}`;
    const tx: SubmittableExtrinsic<'promise'> = this.api.tx.system.remark(remark);

    await tx.signAndSend(signer);
  }

  /**
   * Starts listening for CHAI credential messages. When a remark is
   * detected that matches the CHAI prefix, the provided callback is
   * invoked with the originating parachain id and parsed message.
   */
  listenForCredentials(onMessage: (paraId: number, message: ChaiCredentialMessage) => void): void {
    this.api.query.system.events((events) => {
      events.forEach(({ event }) => {
        if (event.section === 'system' && event.method === 'Remarked') {
          const [account, data] = event.data as unknown as [string, string];
          const text = data.toString();
          if (text.startsWith('CHAI:')) {
            const [, paraId, payload] = text.split(':');
            try {
              const message = JSON.parse(payload) as ChaiCredentialMessage;
              onMessage(Number(paraId), message);
            } catch (err) {
              console.error('Failed to parse CHAI credential message', err);
            }
          }
        }
      });
    });
  }
}

export default XcmHandler;

