/**
 * zeroPhiGuard — M4-1 schema-level guard enforcing the doctrine invariant
 * "Zero PHI on-chain". Any value about to be written to a public ledger /
 * substrate anchor must pass through `assertHashOnlyAnchor`, which rejects
 * anything that is not a cryptographic hash (or a small set of safe numeric
 * metadata). Free-form strings — which could carry a name, NPI, email, DOB, or
 * any PHI/PII — fail closed.
 *
 * This is a NECESSARY, not sufficient, control: it is a last-line schema gate at
 * the anchor boundary. It does not replace upstream minimization.
 */

// A cryptographic hash: 32-byte (sha256) or 64-byte (sha512) hex, optional 0x.
const HEX_HASH = /^(0x)?([0-9a-fA-F]{64}|[0-9a-fA-F]{128})$/;

// Keys allowed on an anchor object. Values must be hashes (hash-ish keys) or
// finite numbers (metadata keys). Anything else is rejected.
const HASH_KEYS = new Set([
  'payload_hash',
  'payloadHash',
  'merkleRoot',
  'root',
  'hash',
  'leafHash',
  'anchoredRoot',
  'eventHash',
]);
const NUMERIC_META_KEYS = new Set([
  'block',
  'blockNumber',
  'extrinsic_index',
  'extrinsicIndex',
  'eventCount',
  'timestamp',
  'time',
  'index',
  'version',
]);

// Defense-in-depth PHI/PII denylist. If any candidate string matches, fail
// closed even if it somehow reached a value slot.
const PHI_PATTERNS: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: 'email', re: /[\w.+-]+@[\w-]+\.[\w.-]+/ },
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'phone', re: /\b\d{3}[.\-\s]\d{3}[.\-\s]\d{4}\b/ },
  { name: 'dob', re: /\b(19|20)\d\d[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/ },
  // bare 10-digit NPI in cleartext (a hash is 64+ hex chars, never a lone 10-digit run)
  { name: 'npi', re: /(?<!\d)\d{10}(?!\d)/ },
];

export class PhiOnChainError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Zero-PHI-on-chain violation: ${reason}`);
    this.name = 'PhiOnChainError';
    this.reason = reason;
  }
}

function isHash(value: unknown): value is string {
  return typeof value === 'string' && HEX_HASH.test(value.trim());
}

function assertNoPhi(candidate: string): void {
  for (const { name, re } of PHI_PATTERNS) {
    if (re.test(candidate)) {
      throw new PhiOnChainError(`value matches ${name} PHI/PII pattern`);
    }
  }
}

/**
 * Throws PhiOnChainError unless `value` is safe to anchor on a public ledger:
 * a hash string, an array of hash strings, or an object whose values are all
 * hashes / finite numbers under an allowlisted key. Fails closed on anything else.
 */
export function assertHashOnlyAnchor(value: unknown): void {
  if (isHash(value)) return;

  if (typeof value === 'string') {
    // A non-hash string is never allowed on-chain.
    assertNoPhi(value); // surface a specific PHI reason if applicable…
    throw new PhiOnChainError('on-chain payload must be a hex hash, got a free-form string');
  }

  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (!isHash(v)) throw new PhiOnChainError(`array element ${i} is not a hash`);
    });
    return;
  }

  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (HASH_KEYS.has(k)) {
        if (!isHash(v)) throw new PhiOnChainError(`field "${k}" must be a hash`);
        continue;
      }
      if (NUMERIC_META_KEYS.has(k)) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          throw new PhiOnChainError(`field "${k}" must be a finite number`);
        }
        continue;
      }
      // Any key not on the allowlist is rejected — no free-form fields on-chain.
      throw new PhiOnChainError(`field "${k}" is not an allowlisted hash/metadata key`);
    }
    return;
  }

  throw new PhiOnChainError(`unsupported on-chain payload type: ${typeof value}`);
}

/** Boolean variant for call sites that prefer a guard over a throw. */
export function isHashOnlyAnchor(value: unknown): boolean {
  try {
    assertHashOnlyAnchor(value);
    return true;
  } catch {
    return false;
  }
}
