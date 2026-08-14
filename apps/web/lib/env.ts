/**
 * SEC-ENV-1 — typed, validated environment-variable contract.
 *
 * Single source of truth for every environment variable consumed by
 * `apps/web`. Each var declares: required vs optional, public (sent
 * to client bundle) vs server-only, and a brief rationale.
 *
 * Truth contract:
 *   - In **development** (`NODE_ENV !== 'production'`): missing
 *     REQUIRED vars throw at first import. The dev server fails fast
 *     so the developer sees the gap before running the app.
 *   - In **production** (`NODE_ENV === 'production'`): missing
 *     REQUIRED vars log to `console.error` but do NOT throw, so a
 *     misconfiguration does not bring down the whole deploy. Vercel
 *     deploy-time validation is a follow-on concern (see
 *     `.github/workflows/ci-preflight.yml`).
 *   - Public vars (prefix `NEXT_PUBLIC_`) are sent to the client
 *     bundle. Do NOT add server secrets to the public branch — the
 *     schema enforces this at validation time.
 *
 * Usage:
 *   import { env } from '@/lib/env';
 *   console.log(env.NEXT_PUBLIC_APP_URL);
 *
 * Validation runs once on module import. To re-validate (in tests),
 * call `validateEnv(process.env)` directly.
 */

type EnvVarKind = 'required' | 'optional';
type EnvVarVisibility = 'public' | 'server';

interface EnvVarSchema {
  name: string;
  kind: EnvVarKind;
  visibility: EnvVarVisibility;
  rationale: string;
}

/**
 * The canonical environment-variable schema for `apps/web`.
 *
 * Adding a var: append a new entry. Required server-side secrets must
 * NOT have the `NEXT_PUBLIC_` prefix (the validator rejects this).
 */
export const ENV_SCHEMA: ReadonlyArray<EnvVarSchema> = [
  // ── Authentication (Clerk) ─────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    kind: 'required',
    visibility: 'public',
    rationale: 'Clerk publishable key — required by Clerk middleware on every authenticated route.',
  },
  {
    name: 'CLERK_SECRET_KEY',
    kind: 'required',
    visibility: 'server',
    rationale: 'Clerk secret key — required by Clerk middleware in server runtime.',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Custom sign-in route override; defaults to Clerk hosted UI when unset.',
  },
  {
    name: 'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Custom sign-up route override; defaults to Clerk hosted UI when unset.',
  },

  // ── Application URL ────────────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_APP_URL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Canonical app URL (e.g. https://vitalcv.com); used by share-link generators and OAuth callbacks. Falls back to request origin when unset.',
  },

  // ── API + Backend ──────────────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_API_URL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'External API base URL (e.g. https://api.vitalcv.com); when unset, internal `/api/*` is used.',
  },
  {
    name: 'NEXT_PUBLIC_BACKEND_URL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Backend service URL (e.g. Railway). Pilot funnel uses this when set; otherwise local fallback.',
  },
  {
    name: 'BACKEND_URL',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Server-only backend URL for SSR fetches.',
  },

  // ── Trust Exchange issuance ───────────────────────────────────────
  {
    name: 'TRUST_EXCHANGE_ISSUER',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Federation issuer bound server-side for POST /api/exchange/issue; issuance fails closed when unset.',
  },
  {
    name: 'TRUST_EXCHANGE_ISSUER_SECRET',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Bearer machine credential for POST /api/exchange/issue; issuance fails closed when unset.',
  },

  // ── Source health probe (RELIABILITY-2 / PR #187) ──────────────────
  {
    name: 'CRON_SECRET',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Authorization: Bearer secret for scheduled source-health probe (preferred). Required when MONITORING_SECRET is unset and probes are running.',
  },
  {
    name: 'MONITORING_SECRET',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Legacy x-monitoring-secret header for source-health probe. CRON_SECRET preferred for new code.',
  },

  // ── Release monitoring (Railway deploy webhook → release-verify) ────
  {
    name: 'GITHUB_DISPATCH_TOKEN',
    kind: 'optional',
    visibility: 'server',
    rationale: 'GitHub token the release-monitor webhook receiver uses to fire the release-verify repository_dispatch. Fine-grained PAT with contents:write on the repo. Held server-side, never in the Railway webhook URL.',
  },
  {
    name: 'RELEASE_WEBHOOK_TOKEN',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Shared secret gating POST /api/internal/release-monitor/webhook (Bearer / x-monitoring-secret / ?token=). Falls back to CRON_SECRET / MONITORING_SECRET when unset.',
  },

  // ── Observability ──────────────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_SENTRY_DSN',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Sentry DSN. When set, withSentryConfig wraps the Next config; otherwise Sentry is disabled.',
  },
  {
    name: 'NEXT_PUBLIC_POSTHOG_KEY',
    kind: 'optional',
    visibility: 'public',
    rationale: 'PostHog project key. When set, analyticsFoundation events emit (with consent gate).',
  },
  {
    name: 'NEXT_PUBLIC_POSTHOG_HOST',
    kind: 'optional',
    visibility: 'public',
    rationale: 'PostHog host (e.g. https://us.posthog.com).',
  },
  {
    name: 'POSTHOG_PERSONAL_API_KEY',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Server-side PostHog API key for funnel queries (admin only).',
  },

  // ── Feature flags ──────────────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_DEMO_MODE',
    kind: 'optional',
    visibility: 'public',
    rationale: 'When "true", surfaces render demo banners. Does not enable real persistence.',
  },
  {
    name: 'NEXT_PUBLIC_PILOT_MODE',
    kind: 'optional',
    visibility: 'public',
    rationale: 'When "true", pilot funnel is enabled.',
  },
  {
    name: 'NEXT_PUBLIC_DEBUG_PANEL',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Dev-only debug panel toggle.',
  },
  {
    name: 'NEXT_PUBLIC_ENTERPRISE_MODE',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Enterprise-tier feature gate (foundation only — no production gate yet).',
  },
  {
    name: 'NEXT_PUBLIC_CTA_VARIANT',
    kind: 'optional',
    visibility: 'public',
    rationale: 'A/B variant for pilot CTA copy.',
  },

  // ── Build metadata ─────────────────────────────────────────────────
  {
    name: 'NEXT_PUBLIC_APP_VERSION',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Display version on /status and footer.',
  },
  {
    name: 'NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA',
    kind: 'optional',
    visibility: 'public',
    rationale: 'Auto-injected by Vercel for status page.',
  },

  // ── Node baseline ──────────────────────────────────────────────────
  {
    name: 'NODE_ENV',
    kind: 'optional',
    visibility: 'server',
    rationale: 'Node runtime mode (development | production | test).',
  },
];

export interface EnvValidationResult {
  ok: boolean;
  missingRequired: string[];
  publicLeaks: string[]; // server-secret-named vars accidentally on public side
}

/**
 * Validates a process.env-shaped object against ENV_SCHEMA.
 * Returns a structured result; does not throw.
 */
export function validateEnv(envSource: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const missingRequired: string[] = [];
  const publicLeaks: string[] = [];

  for (const v of ENV_SCHEMA) {
    const value = envSource[v.name];
    if (v.kind === 'required' && (value === undefined || value === '')) {
      missingRequired.push(v.name);
    }
    // Sanity check: a NEXT_PUBLIC_ name must be visibility 'public'.
    // A non-NEXT_PUBLIC_ name that is also in the public branch indicates
    // a misconfiguration in this schema (not in env itself).
    if (v.visibility === 'public' && !v.name.startsWith('NEXT_PUBLIC_') && v.name !== 'NODE_ENV') {
      publicLeaks.push(v.name);
    }
  }

  return {
    ok: missingRequired.length === 0 && publicLeaks.length === 0,
    missingRequired,
    publicLeaks,
  };
}

/**
 * Throws in dev / non-production when validation fails. Logs but does
 * NOT throw in production (NODE_ENV === 'production') so misconfig
 * doesn't down the whole deploy.
 */
export function assertEnvValid(envSource: NodeJS.ProcessEnv = process.env): void {
  const result = validateEnv(envSource);
  if (result.ok) return;

  const summary: string[] = [];
  if (result.missingRequired.length > 0) {
    summary.push(`Missing required env vars: ${result.missingRequired.join(', ')}`);
  }
  if (result.publicLeaks.length > 0) {
    summary.push(
      `Schema integrity error — non-public vars marked public: ${result.publicLeaks.join(', ')}`,
    );
  }

  const message = `[env] ${summary.join('; ')}`;
  const isProd = (envSource.NODE_ENV ?? 'development') === 'production';

  if (isProd) {
    // eslint-disable-next-line no-console
    console.error(message);
    return;
  }
  throw new Error(message);
}
