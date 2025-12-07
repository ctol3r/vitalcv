import { SignJWT, jwtVerify, importJWK, exportJWK, generateKeyPair } from 'jose';

export interface AgentMessage {
  agentId: string;
  toolCall: {
    tool: string;
    params: Record<string, unknown>;
  };
  timestamp: number;
  purpose?: string;
}

export interface SignedAgentMessage extends AgentMessage {
  signature: string;
}

/**
 * Agent message signing service
 * Signs all agent→tool calls with Ed25519 detached JWS
 */
export class AgentMessageSigner {
  private privateKey: any;
  private publicKeyJWK: any;

  constructor() {
    // In production, load from secure key storage
    this.initializeKeys();
  }

  private async initializeKeys() {
    const { publicKey, privateKey } = await generateKeyPair('EdDSA');
    this.privateKey = privateKey;
    this.publicKeyJWK = await exportJWK(publicKey);
  }

  /**
   * Sign agent message with Ed25519 detached JWS
   */
  async signMessage(message: AgentMessage): Promise<SignedAgentMessage> {
    const payload = {
      agentId: message.agentId,
      toolCall: message.toolCall,
      timestamp: message.timestamp,
      purpose: message.purpose,
    };

    const signature = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'EdDSA' })
      .sign(this.privateKey);

    return {
      ...message,
      signature,
    };
  }

  /**
   * Get public key for verification
   */
  getPublicKey(): any {
    return this.publicKeyJWK;
  }
}

/**
 * Agent message verifier
 * Verifies signed agent messages and rejects unsigned messages
 */
export class AgentMessageVerifier {
  private publicKey: any;

  constructor(publicKeyJWK: any) {
    this.publicKey = publicKeyJWK;
  }

  /**
   * Verify signed agent message
   */
  async verifyMessage(signedMessage: SignedAgentMessage): Promise<boolean> {
    if (!signedMessage.signature) {
      throw new Error('Message missing signature');
    }

    try {
      const key = await importJWK(this.publicKey, 'EdDSA');
      const payload = {
        agentId: signedMessage.agentId,
        toolCall: signedMessage.toolCall,
        timestamp: signedMessage.timestamp,
        purpose: signedMessage.purpose,
      };

      await jwtVerify(signedMessage.signature, key, {
        algorithms: ['EdDSA'],
      });

      return true;
    } catch (error) {
      throw new Error(`Signature verification failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}

// Singleton instances
let signer: AgentMessageSigner | null = null;
let verifier: AgentMessageVerifier | null = null;

export async function getSigner(): Promise<AgentMessageSigner> {
  if (!signer) {
    signer = new AgentMessageSigner();
    await signer['initializeKeys']();
  }
  return signer;
}

export async function getVerifier(): Promise<AgentMessageVerifier> {
  if (!verifier) {
    const signerInstance = await getSigner();
    const publicKey = signerInstance.getPublicKey();
    verifier = new AgentMessageVerifier(publicKey);
  }
  return verifier;
}

