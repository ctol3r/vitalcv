import { randomUUID } from 'crypto';

export type PresentationSessionStatus = 'pending' | 'verified' | 'failed';

export interface PresentationSession {
  nonce: string;
  state: string;
  clientId: string;
  presentationDefinition: any;
  expectedSchema?: string;
  status: PresentationSessionStatus;
  verificationResult?: any;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_SESSION_TTL_MS = (parseInt(process.env.OIDC4VP_SESSION_TTL_SECONDS ?? '900', 10) || 900) * 1000;

class PresentationSessionStore {
  private readonly sessions = new Map<string, PresentationSession>();
  private readonly stateIndex = new Map<string, string>();

  createSession(presentationDefinition: any, clientId: string, expectedSchema?: string): { nonce: string; state: string } {
    this.purgeExpired();
    const nonce = randomUUID();
    const state = randomUUID();
    const now = Date.now();

    const session: PresentationSession = {
      nonce,
      state,
      clientId,
      presentationDefinition,
      expectedSchema,
      status: 'pending',
      createdAt: now,
      expiresAt: now + DEFAULT_SESSION_TTL_MS,
    };

    this.sessions.set(nonce, session);
    this.stateIndex.set(state, nonce);

    return { nonce, state };
  }

  getSession(nonce: string): PresentationSession | undefined {
    this.purgeExpired();
    return this.sessions.get(nonce);
  }

  getSessionByState(state: string): PresentationSession | undefined {
    this.purgeExpired();
    const nonce = this.stateIndex.get(state);
    return nonce ? this.sessions.get(nonce) : undefined;
  }

  updateSession(nonce: string, update: Partial<PresentationSession>): void {
    const session = this.sessions.get(nonce);
    if (!session) return;
    this.sessions.set(nonce, { ...session, ...update });
  }

  purgeExpired(): void {
    const now = Date.now();
    for (const [nonce, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(nonce);
        this.stateIndex.delete(session.state);
      }
    }
  }
}

export const presentationSessionStore = new PresentationSessionStore();











