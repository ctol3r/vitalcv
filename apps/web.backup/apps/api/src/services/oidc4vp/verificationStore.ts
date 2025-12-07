import type { VerificationResult } from './types';

const TTL_MS = Number(process.env.VERIFICATION_RESULT_TTL_MS || 1000 * 60 * 60); // 1 hour default
const MAX_RESULTS = Number(process.env.VERIFICATION_RESULT_CAP || 200);

interface StoredVerification {
  result: VerificationResult;
  recordedAt: number;
}

class VerificationStore {
  private store = new Map<string, StoredVerification>();

  save(result: VerificationResult) {
    this.store.set(result.presentationId, {
      result,
      recordedAt: Date.now(),
    });
    this.prune();
  }

  get(presentationId: string): VerificationResult | undefined {
    const entry = this.store.get(presentationId);
    if (!entry) {
      return undefined;
    }

    if (Date.now() - entry.recordedAt > TTL_MS) {
      this.store.delete(presentationId);
      return undefined;
    }

    return entry.result;
  }

  private prune() {
    if (this.store.size <= MAX_RESULTS) {
      return;
    }

    const entries = Array.from(this.store.entries()).sort(
      (a, b) => a[1].recordedAt - b[1].recordedAt,
    );

    while (entries.length > MAX_RESULTS) {
      const oldest = entries.shift();
      if (oldest) {
        this.store.delete(oldest[0]);
      }
    }
  }
}

export const verificationStore = new VerificationStore();

