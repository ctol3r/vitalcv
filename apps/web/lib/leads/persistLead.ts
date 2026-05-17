import 'server-only';

import { mkdir, appendFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * persistLead — file-system JSONL append for /api/leads submissions.
 *
 * No DB. No Prisma. No external network beyond an optional Slack
 * notification (handled separately).
 *
 * Persistence target precedence:
 *   1. process.env.LEAD_LOG_PATH (operator override)
 *   2. ~/.vitalcv-logs/leads.jsonl  (default)
 *
 * Truth-contract guardrails:
 *   - Never persists raw PHI or credential documents (route layer
 *     enforces field allowlist before reaching this function).
 *   - Hashes coarse caller identity (ip) with SHA-256 + a daily salt
 *     so the file never contains a raw IP. Never stores user-agent
 *     beyond a 200-char truncation.
 *   - Generates a stable per-lead id (UUID v4) for downstream
 *     dedupe / Slack message threading.
 */

export type LeadIntent = 'waitlist' | 'pilot' | 'walkthrough' | 'early_access';

/** Maximum number of NPIs persisted from a single submission. */
export const MAX_SAMPLE_NPIS = 25;

export interface LeadInput {
  email: string;
  intent: LeadIntent;
  source?: string;
  /**
   * Sanitized, deduplicated array of 10-digit NPI-like strings extracted
   * from the submission. Bounded by MAX_SAMPLE_NPIS. The submitter may
   * paste surrounding text in the form; only digit-run matches are kept
   * and the raw text is dropped at the validation boundary.
   */
  sampleNpis?: string[];
  /** Optional coarse caller context — already-hashed on arrival. */
  ipHash?: string;
  /** Optional truncated user-agent (≤200 chars). */
  userAgentTrunc?: string;
}

export interface PersistedLead extends LeadInput {
  leadId: string;
  createdAt: string;
  /** Count of sampleNpis at persistence time (denormalized for Slack). */
  sampleNpiCount: number;
}

/** Resolve the JSONL path with env-var override. */
export function resolveLeadLogPath(): string {
  const override = process.env.LEAD_LOG_PATH;
  if (override && override.trim().length > 0) {
    return override;
  }
  return join(homedir(), '.vitalcv-logs', 'leads.jsonl');
}

/** Deterministic daily salt so a single IP within a day hashes consistently
 *  but the same IP across days hashes differently (limits cross-day
 *  correlation in the log). */
function dailySalt(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10); // YYYY-MM-DD
}

export function hashIp(rawIp: string, now: Date = new Date()): string {
  return createHash('sha256').update(`${dailySalt(now)}:${rawIp}`).digest('hex').slice(0, 16);
}

export function truncateUserAgent(ua: string | null | undefined, max = 200): string | undefined {
  if (!ua) return undefined;
  return ua.slice(0, max);
}

export async function persistLead(input: LeadInput): Promise<PersistedLead> {
  const target = resolveLeadLogPath();
  await mkdir(dirname(target), { recursive: true });
  const record: PersistedLead = {
    leadId: randomUUID(),
    createdAt: new Date().toISOString(),
    ...input,
    sampleNpiCount: input.sampleNpis?.length ?? 0,
  };
  const line = JSON.stringify(record) + '\n';
  await appendFile(target, line, { encoding: 'utf8', mode: 0o600 });
  return record;
}

/**
 * Extract NPI-like 10-digit strings from arbitrary input. The submitter
 * may paste anything (a CSV, an email signature, a note). Only the
 * 10-digit digit-runs are kept; everything else is discarded. The result
 * is deduplicated and capped at MAX_SAMPLE_NPIS.
 *
 * This is a sanitizer, not a Luhn-style NPI validator: it does NOT
 * verify the check digit. The purpose is data-minimization at the
 * persistence boundary, not source-verification.
 */
export function sanitizeNpiList(raw: unknown): string[] {
  if (typeof raw !== 'string' || raw.length === 0) return [];
  const matches = raw.match(/(?<!\d)\d{10}(?!\d)/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (seen.has(m)) continue;
    seen.add(m);
    out.push(m);
    if (out.length >= MAX_SAMPLE_NPIS) break;
  }
  return out;
}

/**
 * Email validation — minimal regex matching RFC-5321 local + domain
 * shape. Not exhaustive (no IDN support), but adequate for a lead form.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email);
}

const VALID_INTENTS: ReadonlyArray<LeadIntent> = [
  'waitlist',
  'pilot',
  'walkthrough',
  'early_access',
];

export function isValidIntent(value: unknown): value is LeadIntent {
  return typeof value === 'string' && VALID_INTENTS.includes(value as LeadIntent);
}

/**
 * Validate the request payload. Returns the cleaned input on success
 * or a list of field-keyed errors on failure.
 */
export function validateLeadInput(
  body: unknown,
): { ok: true; value: LeadInput } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (!body || typeof body !== 'object') {
    return { ok: false, errors: { _form: 'payload must be a JSON object' } };
  }

  const b = body as Record<string, unknown>;

  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!email) {
    errors.email = 'email is required';
  } else if (email.length > 320) {
    errors.email = 'email too long';
  } else if (!isValidEmail(email)) {
    errors.email = 'email is not in a recognized format';
  }

  const intent = b.intent;
  if (!isValidIntent(intent)) {
    errors.intent = 'intent must be one of: waitlist, pilot, walkthrough, early_access';
  }

  // `source` is a bounded, controlled-vocabulary tag set by the client
  // surface (e.g. "launch_page", "demo_employer"). It is the only
  // free-text-ish field that survives the boundary.
  const source = b.source;
  if (source !== undefined && (typeof source !== 'string' || source.length > 200)) {
    errors.source = 'source must be a string ≤200 chars';
  }

  // Submitters may paste an NPI list (with or without surrounding text)
  // in either `npiList` (legacy field name from the client) or
  // `sampleNpis` (array form). The surrounding text is intentionally
  // dropped here — only the 10-digit digit-runs survive sanitation.
  //
  // We DO NOT accept or persist a free-text `message` field. If a
  // submitter sends one, the route still succeeds (so the form is not
  // brittle), but the text is silently dropped before persistence.
  const npiListRaw = b.npiList;
  if (
    npiListRaw !== undefined
    && (typeof npiListRaw !== 'string' || npiListRaw.length > 2000)
  ) {
    errors.npiList = 'npiList must be a string ≤2000 chars';
  }
  const sampleNpisRaw = b.sampleNpis;
  if (sampleNpisRaw !== undefined && !Array.isArray(sampleNpisRaw)) {
    errors.sampleNpis = 'sampleNpis must be an array of 10-digit strings';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const sanitizedFromString = sanitizeNpiList(npiListRaw);
  const sanitizedFromArray = sanitizeNpiList(
    Array.isArray(sampleNpisRaw) ? sampleNpisRaw.join(' ') : undefined,
  );
  const merged: string[] = [];
  const seen = new Set<string>();
  for (const n of [...sanitizedFromArray, ...sanitizedFromString]) {
    if (seen.has(n)) continue;
    seen.add(n);
    merged.push(n);
    if (merged.length >= MAX_SAMPLE_NPIS) break;
  }

  return {
    ok: true,
    value: {
      email,
      intent: intent as LeadIntent,
      source: typeof source === 'string' ? source : undefined,
      sampleNpis: merged.length > 0 ? merged : undefined,
    },
  };
}

// ── In-memory per-ip-hash rate limit ──────────────────────────────────────

interface RateBucket {
  hits: number;
  windowStartMs: number;
}

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 min
const RATE_LIMIT_MAX = 3; // > 3 in 5 min → 429
const rateBuckets = new Map<string, RateBucket>();

export interface RateLimitCheck {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
): RateLimitCheck {
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStartMs > RATE_LIMIT_WINDOW_MS) {
    rateBuckets.set(key, { hits: 1, windowStartMs: now });
    return { allowed: true };
  }
  bucket.hits += 1;
  if (bucket.hits > RATE_LIMIT_MAX) {
    const elapsed = now - bucket.windowStartMs;
    const retryAfterSeconds = Math.ceil((RATE_LIMIT_WINDOW_MS - elapsed) / 1000);
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

/** Testing helper — resets the in-memory rate bucket state. */
export function _resetRateBuckets(): void {
  rateBuckets.clear();
}
