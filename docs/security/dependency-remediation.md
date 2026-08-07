# Dependency remediation & burn-down

**Enterprise-map B1 (supply chain) · ASVS G8 (SCA).**
Owner: platform security · Last updated: 2026-07-20

This is the living register for third-party dependency vulnerabilities. Two
gates block new **criticals** — the
**[pnpm SCA gate](../../.github/workflows/security-audit.yml)** for the
JavaScript tree and the
**[Rust SCA gate](../../.github/workflows/cargo-audit.yml)** for the Cargo trees
(see [Rust / Cargo SCA](#rust--cargo-sca)) — and everything else is tracked here
and burned down deliberately so
the signal stays actionable instead of permanently red. A narrow, documented
escape hatch (**[Accepted-risk audit ignores](#accepted-risk-audit-ignores)**)
exists for a critical that reaches only a build-time / non-deploy-path surface
and cannot be safely upgraded or overridden.

## Policy

| Severity | CI behavior | Rationale |
|---|---|---|
| **Critical** | ❌ **blocks merge** (`scripts/security/audit-gate.mjs` exits 1) | A critical in a shipped dependency is never acceptable. Fix with an upgrade or `pnpm.overrides` before merge. |
| High | ⚠️ reported, non-blocking | 75 pre-existing highs; a hard gate here would be permanently red and train reviewers to ignore it. Burned down in waves (below). |
| Moderate / Low | reported, non-blocking | Batched via Dependabot version updates. |
| **Accepted-risk ignore** | 🔕 suppressed via `pnpm.auditConfig.ignoreGhsas` | **Narrow exception** for a critical that reaches **only** a build-time / non-deploy-path surface and cannot be safely upgraded or overridden. Requires an **owner sign-off** + a row in [Accepted-risk audit ignores](#accepted-risk-audit-ignores). The gate counts criticals from the (ignore-aware) advisory list, so a documented ignore clears the bar while any *un-ignored* critical still blocks. |

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
| + PR #572 (protobufjs / shell-quote overrides) | **0** | **75** | **67** | **14** | **156** | **criticals eliminated** |
| 2026-07-20 (`tar` GHSA-23hp-3jrh-7fpw ignore) | **0** *(1 suppressed)* | 79 | 75 | 16 | 170 | new build-time critical newly disclosed against `tar@6.2.1`; accepted-risk ignore (below). High/moderate drift = registry advisory DB growth, not new deps. |
| 2026-07-21 (#812 — revert #808's `tar` override) | **0** *(1 suppressed)* | 79 | 75 | 16 | 170 | `tar` back to `6.2.1`; #808's `>=7.5.19` override broke `@expo/cli` on `main`. Counts unchanged — the ignore already held the gate. |
| 2026-08-02 (Expo SDK 52→53 — `tar` remediated) | **0** *(0 suppressed)* | 74 | 63 | 17 | 154 | `apps/mobile` expo `~53.0.0` → `@expo/cli@0.24.24` declares `tar ^7.4.3` → resolves **7.5.22** (patched). `tar@6.2.1` no longer in the lockfile at all; GHSA-23hp-3jrh-7fpw ignore **removed** — the gate passes with an empty ignore list. High/moderate drop = Next 15.5.22 (#1029) + the SDK-52 subtree leaving the tree. |

### Criticals — DONE (0 remaining)

| Package | Fix | Advisory |
|---|---|---|
| `@clerk/nextjs` (+ `@clerk/shared`) | bump `apps/web` → `^6.39.5` | GHSA-vqx2-fgx2-5wq9 — middleware route-protection **bypass** (P0, auth boundary) |
| `protobufjs` | `pnpm.overrides` → `^7.5.5` (resolves 7.6.5) | GHSA-xq3m-2v4x-88gg — arbitrary code execution. Transitive via `posthog-js` → OTLP exporter (apps/web). |
| `shell-quote` | `pnpm.overrides` → `^1.8.4` (resolves 1.9.0) | GHSA-w7jw-789q-3m8p — `quote()` newline-escape bypass. Transitive via `react-native` → `react-devtools-core` (apps/mobile). |

## Accepted-risk audit ignores

Criticals suppressed via `pnpm.auditConfig.ignoreGhsas` in the root
`package.json`. This list is the **only** sanctioned reason a critical does not
block. Each entry is a deliberate, owner-signed decision — not a convenience.
The gate ([`audit-gate.mjs`](../../scripts/security/audit-gate.mjs)) counts
criticals from the ignore-aware advisory list, so these clear the bar while any
*other* critical still fails the build. Re-evaluate every entry whenever its
revisit condition changes.

| GHSA | Package | Severity | Reaches | Signed off | Revisit when |
|---|---|---|---|---|---|
| *(none — list is empty as of 2026-08-02)* | | | | | |

### RESOLVED 2026-08-02 — GHSA-23hp-3jrh-7fpw — node-tar decompression/parse DoS

**How it was resolved.** Revisit condition (b) fired: the Expo SDK 53 line
ships `@expo/cli@0.24.24` with a **declared** `tar: ^7.4.3` dependency (its
compiled code imports `tar@7` correctly — no `_interopRequireDefault` shim
against a missing default export). Bumping `apps/mobile` from `expo ~52.0.0` to
`expo ~53.0.0` (with `expo install --fix` aligning the companion packages,
react 19.0.0 / react-native 0.79.6) removed `tar@6.2.1` from the lockfile
entirely; the only `tar` in the tree is now **7.5.22** (patched ≥7.5.19). The
`ignoreGhsas` entry was removed and the gate passes with an **empty** ignore
list. Unlike #808's override, the fix was exercised for real: `@expo/cli`'s own
`build/src/utils/npm.js` `extractNpmTarballFromUrlAsync` downloaded and
extracted a live registry tarball (`expo-status-bar@2.2.3`, 7 files) with
`tar@7.5.22` resolved from the CLI's context — the exact call path that threw
`TypeError` under the override. Mobile `tsc --noEmit` and the 3-file vitest
suite (9 tests) pass on SDK 53; the lockfile's `importers` diff is confined to
`apps/mobile`.

The history below is preserved because its lesson outlives the advisory:
**upgrade the consumer, never force an override the consumer can't load.**

#### Original analysis (2026-07-20, while the ignore was in force)

**What it is.** node-tar `<=7.5.18` does not bound total decompressed bytes or
entry counts, so a tiny "gzip bomb" can exhaust disk/CPU during extraction.
Patched in `tar@>=7.5.19`; **no patched `6.x` line exists**.

**Why it's an accepted risk here (not a real exposure).** The only `tar` in the
tree is `tar@6.2.1`, reachable through exactly one consumer: **`@expo/cli`** (a
build/dev CLI under `apps/mobile → expo`). It is **never bundled into a shipped
runtime** — not `apps/web`, not `apps/api/*`, not even the release RN app binary
— and it only ever extracts Expo's own trusted CDN/npm archives at developer
build time, never untrusted attacker input. `apps/mobile` is **not on the
production deployment path**. (The `cacache@18 → tar` edge that also appears in
the graph is dead code — `cacache` lists `tar` as a dependency but never
`require`s it.)

**Why we did not upgrade/override (the endorsed remediation) — verified.**
Forcing `tar@6→7` via `pnpm.overrides` turns the gate green with a clean
lockfile, **but provably breaks `@expo/cli` at runtime.** `tar@7`'s CommonJS
build sets `__esModule = true` with **no `.default` export**; `@expo/cli`'s
compiled code calls `_interopRequireDefault(require("tar")).default.extract(…)`,
which under `tar@7` evaluates to `undefined.extract` → **`TypeError` thrown**.
The `extractNpmTarballAsync` path in `@expo/cli` (used by `expo install` /
`expo prebuild`) has no native-`tar` fallback, so it breaks unconditionally. The
fast CI never exercises Expo, so the override would merge **silently broken**.
Because `@expo/cli` is `tar`'s *sole* consumer, no scoped override can satisfy
the gate without also hitting the consumer that breaks; and bumping the Expo SDK
is a large, fast-CI-unverifiable migration disproportionate to a dormant app.
Hence the documented ignore.

> **This was confirmed the hard way — do not re-attempt the override.** A
> parallel lane briefly landed exactly that override on `main` in **#808**
> (`"tar": ">=7.5.19"`), which its own commit message flagged as unverified
> ("*if tar@7 disagrees with @expo/cli at build time, the fallback is to scope
> the SCA audit rather than the override*"). It does disagree: with #808 on
> `main`, `@expo/cli` resolved `tar@7.5.20` and its extract path threw
> `Cannot read properties of undefined (reading 'extract')`. The override was
> reverted in **#812**, restoring `tar@6.2.1` and a working Expo toolchain while
> the ignore below keeps the gate green. The advisory is build-time-only, so the
> ignore costs nothing that the override was buying.

**Blast-radius note.** This entry leaves `apps/mobile` running the vulnerable
`tar@6.2.1` in its **build toolchain**. That is the accepted risk. It is bounded
to developer machines building the mobile app against trusted inputs; nothing on
the trust platform's shipped surface is affected.

## Rust / Cargo SCA

`pnpm audit` cannot see Rust dependencies **at all**. Until 2026-07-25 the
repo's seven `Cargo.lock` files had **zero** SCA coverage — Dependabot was
raising critical alerts against them that no CI job could surface, so a green
"SCA — critical-only gate" said nothing whatsoever about Rust.

**The repo now ships no Rust at all.** The dormant Substrate pallet trees were
deleted on 2026-07-25 (founder decision), which removed **all 171** Rust
advisories outright — including `RUSTSEC-2023-0090` (`wasmtime@1.0.2`, CVSS 9.9,
guest-controlled OOB read/write), 28 lower-severity advisories, and 136 unscored
ones such as `RUSTSEC-2022-0093` (`ed25519-dalek` double-public-key signing
oracle). Deleting beat suppressing: the pallets were never built or deployed, and
the advisory was unfixable in place (`sp-wasm-interface@8.0.0` pins
`wasmtime ^1.0.0`, so `cargo update -p wasmtime --precise 4.0.1` cannot resolve —
clearing it would have meant upgrading the whole `frame-support 4.0` /
`sp-runtime 7.0` stack). See
[the anchoring ADR](../architecture/adr-substrate-anchoring.md).

The **[Rust SCA gate](../../.github/workflows/cargo-audit.yml)**
([`cargo-audit-gate.mjs`](../../scripts/security/cargo-audit-gate.mjs)) stays
in place as a **tripwire**: it auto-discovers `Cargo.lock` files, so the day any
Rust re-enters the repo it is audited from the first commit rather than sitting
unscanned for years as the pallets did. With no lockfiles present it reports
"nothing to audit" and exits 0.

Policy mirrors the pnpm gate:

| Severity | CI behavior | Rationale |
|---|---|---|
| **Critical** (CVSS ≥ 9.0) | ❌ **blocks merge** (gate exits 1) | Same bar as the pnpm gate. |
| High / moderate / low | ⚠️ reported, non-blocking | Same rationale as the JS backlog. |
| **Unscored** | ⚠️ reported, non-blocking, **needs triage** | Many RustSec advisories carry no CVSS vector and cannot be classified. They are printed on every run so they cannot rot silently. |
| **Accepted-risk ignore** | 🔕 suppressed via [`cargo-audit-ignores.json`](../../scripts/security/cargo-audit-ignores.json) | Same bar as `pnpm.auditConfig.ignoreGhsas`. **Currently empty, which is the correct state** — prefer deleting dead Rust over suppressing its advisories. |

cargo-audit reports only a CVSS *vector*, never a score, so the gate computes
the base score itself (CVSS v3.1 spec §8.1). That arithmetic is pinned by
`apps/web/__tests__/cargo-audit-gate.test.ts` against published ratings — if it
drifts, criticals get silently misclassified. Run it locally:

```bash
cargo install cargo-audit --locked   # once
node scripts/security/cargo-audit-gate.mjs
```

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

`@xmldom/xmldom` (5), `node-forge` (4), `tar` (6 high **+ 1 critical**),
`@babel/plugin-transform-modules-systemjs` (1), plus the bulk of `minimatch` /
`picomatch` install paths.

These sit under React Native / Expo and **cannot be safely force-overridden**
without risking the RN toolchain. `apps/mobile` is **not currently on the
production deployment path** for the trust platform. **Accepted risk, tracked** —
revisit when either (a) `apps/mobile` ships, or (b) RN/Expo publishes patched
transitives. Needs an explicit owner sign-off to keep as accepted risk.

> **`tar` note (2026-07-20):** the "cannot be safely force-overridden" caution
> is now empirically confirmed — see
> [Accepted-risk audit ignores](#accepted-risk-audit-ignores). A newly disclosed
> **critical** (GHSA-23hp-3jrh-7fpw) landed on `tar@6.2.1`; the `tar@6→7`
> override provably breaks `@expo/cli`, so the critical is carried as a
> documented `ignoreGhsas` entry rather than an override. The 6 `tar` *highs*
> remain in this backlog and are non-blocking.

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
- The **only** sanctioned way to pass the gate with a critical still in the tree is a `pnpm.auditConfig.ignoreGhsas` entry that meets **all** of: (1) reaches a build-time / non-deploy-path surface only, (2) cannot be safely upgraded or overridden (say why), (3) has an owner sign-off, and (4) has a documented row in [Accepted-risk audit ignores](#accepted-risk-audit-ignores). Anything else must be remediated, not ignored.
