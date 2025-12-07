const STATE_TTL_MS = Number(process.env.SSO_STATE_TTL_MS || 5 * 60 * 1000);

type StateRecord = {
  providerId: string;
  orgId: string;
  nonce: string;
  createdAt: number;
};

const memoryStore = new Map<string, { record: StateRecord; expiresAt: number }>();

function purgeExpired() {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}

export async function persistSsoState(state: string, record: StateRecord) {
  purgeExpired();
  memoryStore.set(state, {
    record,
    expiresAt: Date.now() + STATE_TTL_MS,
  });
}

export async function consumeSsoState(state: string): Promise<StateRecord | null> {
  purgeExpired();
  const entry = memoryStore.get(state);
  if (!entry) {
    return null;
  }
  memoryStore.delete(state);
  return entry.record;
}
