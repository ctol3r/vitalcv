# Dependency remediation & burn-down

**Enterprise-map B1 (supply chain) · ASVS G8 (SCA).**
Owner: platform security · Last updated: 2026-07-06

This is the living register for third-party dependency vulnerabilities. The
**[SCA gate](../../.github/workflows/security-audit.yml)** blocks new
**criticals**; everything else is tracked here and burned down deliberately so
the signal stays actionable instead of permanently red.

## Policy

| Severity | CI behavior | Rationale |
|---|---|---|
| **Critical** | ❌ **blocks merge** (`scripts/security/audit-gate.mjs` exits 1) | A critical in a shipped dependency is never acceptable. Fix with an upgrade or `pnpm.overrides` before merge. |
| High | ⚠️ reported, non-blocking | 75 pre-existing highs; a hard gate here would be permanently red and train reviewers to ignore it. Burned down in waves (below). |
| Moderate / Low | reported, non-blocking | Batched via Dependabot version updates. |

The gate reads `pnpm audit --prod` (production tree only — dev-only tooling
advisories are excluded from the merge signal). Run it locally:

```bash
node scripts/security/audit-gate.mjs
```

## Status

| Date | Critical | High | Moderate | Low | Total | Note |
|---|---:|---:|---:|---:|---:|---|
| 2026-07-05 (baseline, `origin/main`) | 4 | 85 | 72 | 14 | 175 | pre-remediation |
| + PR #569 (`@clerk/nextjs` → 6.39.5) | 2 | 80 | 72 | 14 | 168 | cleared Clerk cluster crit + 5 highs |
| + this PR (protobufjs / shell-quote overrides) | **0** | **75** | **67** | **14** | **156** | **criticals eliminated** |

### Criticals — DONE (0 remaining)

| Package | Fix | Advisory |
|---|---|---|
| `@clerk/nextjs` (+ `@clerk/shared`) | bump `apps/web` → `^6.39.5` | GHSA-vqx2-fgx2-5wq9 — middleware route-protection **bypass** (P0, auth boundary) |
| `protobufjs` | `pnpm.overrides` → `^7.5.5` (resolves 7.6.5) | GHSA-xq3m-2v4x-88gg — arbitrary code execution. Transitive via `posthog-js` → OTLP exporter (apps/web). |
| `shell-quote` | `pnpm.overrides` → `^1.8.4` (resolves 1.9.0) | GHSA-w7jw-789q-3m8p — `quote()` newline-escape bypass. Transitive via `react-native` → `react-devtools-core` (apps/mobile). |

## High-severity backlog (75 advisories, 21 modules)

Ordered by remediation priority. **~45 of 69 distinct high advisories reach a
shipped surface (`apps/web`, `apps/api/*`, `packages/*`); the rest are
`apps/mobile` only.** Path counts are dominated by mobile transitives (e.g.
`minimatch` has 4,179 install paths, almost all under React Native) — path count
is *reach*, not *risk*; prioritize by runtime exposure of the affected surface.

### P1 — direct deps in shipped apps (low effort, do first)

| Package | Where | Current | Target | Highs cleared | Notes |
|---|---|---|---|---:|---|
| `axios` | `apps/web` **direct** | `^1.14.0` (froze <1.15) | `^1.16.0` | 11 | Prototype pollution, proxy-auth credential leak, MITM, ReDoS, SSRF. `^1.14.0` already permits the fix — bump the spec (or `pnpm update axios`) + reinstall. Cheap, high value. |
| `next` | `apps/web`, `apps/marketing` **direct** | `15.2.8` | `>=15.5.18` | 8 | Includes **App Router middleware / proxy bypass** (same class as the Clerk P0), plus DoS (Server Components / `connect`), SSRF, cache-request deserialization. **Framework minor bump — needs full web build + e2e + middleware re-verification.** Highest security value in the backlog; schedule as its own PR. |

### P2 — transitive in `apps/api/*` (server runtime; override + backend gate)

Server-side exposure is real. Fix with `pnpm.overrides` (prefer same-major),
then verify against the backend Postgres gate (PR #568) since backend jest is
not a PR gate.

| Package | Target | Highs | Advisory class |
|---|---|---:|---|
| `undici` | `>=7.28.0` | 5 | WebSocket 64-bit length overflow, unbounded memory, DoS |
| `minimatch` | `>=9.0.7` (and `>=5.1.8`) | 3+ | ReDoS (matchOne backtracking, nested extglobs) |
| `path-to-regexp` | `>=8.4.0` / `>=0.1.13` | 2 | ReDoS (Express routing) |
| `ws` | `>=8.21.0` | 1 | Memory-exhaustion DoS from tiny fragments |
| `lodash` | `>=4.18.0` | 1 | Code injection via `_.template` |
| `defu` | `>=6.1.5` | 1 | Prototype pollution via `__proto__` |
| `effect` | `>=3.20.0` | 1 | `AsyncLocalStorage` context contamination |
| `multer` | `>=2.2.0` | 1 | DoS via deeply nested fields |
| `apollo-server` | **investigate** | 1 | DoS. `apollo-server` is deprecated (no clean patch line → shows `<0.0.0`); likely a migration to `@apollo/server`, not a bump. Needs an owner decision. |

### P3 — transitive in `apps/web` (browser/edge + build; override)

| Package | Target | Highs | Advisory class |
|---|---|---:|---|
| `picomatch` | `>=4.0.4` (and `>=2.3.2`) | 2 | ReDoS via extglob |
| `fast-uri` | `>=3.1.2` | 2 | Path traversal / host confusion via percent-encoding |
| `form-data` | `>=4.0.6` | 1 | CRLF injection |
| `serialize-javascript` | `>=7.0.3` | 1 | RCE via RegExp (build-time) |
| `rollup` | `>=4.59.0` | 1 | Arbitrary file write via path traversal (build-time) |
| `d3-color` | `>=3.1.0` | 1 | ReDoS |

### P4 — `apps/mobile` only (Expo / React Native transitive; deferred + tracked)

`@xmldom/xmldom` (5), `node-forge` (4), `tar` (6), `@babel/plugin-transform-modules-systemjs` (1),
plus the bulk of `minimatch` / `picomatch` install paths.

These sit under React Native / Expo and **cannot be safely force-overridden**
without risking the RN toolchain. `apps/mobile` is **not currently on the
production deployment path** for the trust platform. **Accepted risk, tracked** —
revisit when either (a) `apps/mobile` ships, or (b) RN/Expo publishes patched
transitives. Needs an explicit owner sign-off to keep as accepted risk.

## How to burn one down

```bash
# 1. Locate it
pnpm why <package>

# 2a. Direct dep → bump the range in the owning package.json
# 2b. Transitive → add to root package.json "pnpm.overrides"
#     (prefer the same major to avoid breaking the consumer):
#       "pnpm.overrides": { "<package>": ">=<patched-version>" }

pnpm install

# 3. Rebuild + test the affected workspace(s)
pnpm turbo build --filter=@vitalcv/<workspace>

# 4. Confirm: no new criticals, high count dropped
node scripts/security/audit-gate.mjs

# 5. Delete the row above. Fix-and-remove — never let this table rot.
```

## Guardrails

- **[SCA gate](../../.github/workflows/security-audit.yml)** keeps criticals at 0 while the backlog burns down.
- **[Dependabot](../../.github/dependabot.yml)** opens weekly npm + github-actions update PRs. Enable repo-level **Dependabot security updates** (Settings → Code security) for immediate GHSA-alert PRs.
- Never add an override just to silence the gate for a *critical* — fix the root cause. Overrides are for transitive fixes where the direct consumer hasn't shipped a patched range yet.
