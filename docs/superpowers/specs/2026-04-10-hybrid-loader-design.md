# Hybrid Loader Design — Instant Provider Identity, Then Streaming Upgrade

**Status:** Design approved, ready for implementation
**Branch:** `feat/hybrid-loader`
**Owner:** Chris Toler
**Date:** 2026-04-10

---

## Problem

Today, provider identity only renders instantly on `/passport` (via `useIngestStream`
+ `hydrateFromHomepagePreview`), and only when the user arrives from the homepage
in the same React tree. A fresh visit, a browser reload, or navigating to
`/review/[entityId]` shows a cold load — blank placeholders until the SSR fetch
or SSE stream produces data.

The goal: **any surface that shows provider identity renders instantly on
first paint, every time, then progressively upgrades via SSE.** No blanks. No
flicker. Works on reload. Degrades gracefully when offline.

---

## Non-Goals

- **Do not migrate `/passport` off `useIngestStream`.** `useIngestStream` is the
  canonical streaming hook and remains the source of truth.
- **Do not introduce a new SSE protocol.** Reuse `apps/web/app/api/ingest/stream/[runId]/route.ts`.
- **Do not cache anything beyond provider identity + standing + readiness snapshot.**
  No credential lists, no full `PassportData` blobs — those are server-owned.
- **No new trust status labels.** Reuse `pending` / `verified` / `stale` from
  `apps/web/lib/trust/status-language.ts`.

---

## Constraints (user-locked)

1. **Storage:** `localStorage` + 24h TTL. Synchronous read so first paint has no
   async race.
2. **Source of truth:** `useIngestStream` stays untouched. Its file
   (`apps/web/hooks/useIngestStream.ts`) is not modified.
3. **Reusable wrapper:** A new `useHybridProviderData` hook composes cache +
   `useIngestStream` + SSR seed. `/passport` may opt in to the cache via its
   existing `initialState` parameter without adopting the wrapper.
4. **Must work for `/review` (a server component)** — the SSR payload becomes
   the client hook's initial state via a mapping function.
5. **Never block UI** — partial data is always rendered. Offline uses cache only.

---

## Architecture (Option A — side-effect subscriber)

```
┌───────────────────────────────────────────────────────────────────────┐
│ useHybridProviderData({ key, ssrSeed? })                              │
│                                                                       │
│   1. initialState = ssrSeed ?? readIdentity(key) ?? createInitial()  │
│   2. const { state, startIngest } = useIngestStream(initialState)     │
│   3. useEffect(() => { if (state.isUsable) writeIdentity(key, state) }│
│                                                          , [state])   │
│   4. return { state, startIngest, reset }                             │
└───────────────────────────────────────────────────────────────────────┘
         ▲                               ▲                      ▲
         │ ssrSeed (server)              │ readIdentity (sync)  │ state updates
         │                               │                      │
┌────────┴────────────┐       ┌──────────┴──────────┐   ┌───────┴──────────┐
│ passportToStreamSeed│       │ identityCache.ts    │   │ useIngestStream  │
│ (pure mapper,       │       │ (localStorage, 24h  │   │ (unchanged)      │
│  PassportData →     │       │  TTL, sync read)    │   │                  │
│  Partial<IngestStr.>│       └─────────────────────┘   └──────────────────┘
└─────────────────────┘
```

### Four new files

| File | LOC | Purpose |
|---|---|---|
| `apps/web/lib/hybrid-loader/identityCache.ts` | ~80 | Sync localStorage get/set/prune with 24h TTL |
| `apps/web/lib/hybrid-loader/passportToStreamSeed.ts` | ~60 | Pure `PassportData → Partial<IngestStreamState>` mapper for SSR bridge |
| `apps/web/hooks/useHybridProviderData.ts` | ~60 | Thin wrapper composing cache + SSE + seed |
| `apps/web/__tests__/hybrid-loader.test.*` | ~300 total | Unit tests for all three (+ integration) |

### Three modified files

1. `apps/web/components/review/ReviewClient.tsx` — the review client currently
   receives `passport: PassportData` as a prop from the server component. Change
   the component to additionally call `useHybridProviderData({ key, ssrSeed })`
   where the seed is derived from `passport`. The existing `passport` prop stays
   as the authoritative display source for **static** review data (authority
   credentials, proof sections — all server-owned). The hook adds a **live
   overlay** for identity freshness: "Checking…" → "Updated just now" badges.
2. `apps/web/app/review/[entityId]/ReviewPageClient.tsx` — the server component.
   Compute `passportToStreamSeed(passport)` and pass it as a new `hybridSeed`
   prop to `<ReviewClient>`.
3. `apps/web/lib/trust/status-language.ts` — add `"Checking…"` under `pending`
   and `"Updated just now"` under `verified` in `SAFE_DISPLAY_LABELS`. Two
   additions, no other changes.

**Zero changes** to `useIngestStream.ts` or `ingestStreamState.ts`.

---

## The three primitives

### 1. `identityCache.ts`

```ts
// apps/web/lib/hybrid-loader/identityCache.ts

const KEY_PREFIX = 'vcv:identity:v1:';
const TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface CachedIdentity {
  v: 1;
  savedAt: number;           // epoch ms
  key: string;               // npi or entityId
  identity: StreamIdentity;  // from ingestStreamState
  standing?: StreamStanding;
  readiness?: StreamReadiness;
}

export function readIdentity(key: string): CachedIdentity | null {
  if (typeof window === 'undefined') return null;      // SSR safety
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIdentity;
    if (parsed.v !== 1) return null;
    if (Date.now() - parsed.savedAt > TTL_MS) return null;  // treat as cache miss, not "stale"
    return parsed;
  } catch {
    return null;
  }
}

export function writeIdentity(key: string, partial: Partial<CachedIdentity>): void {
  if (typeof window === 'undefined') return;
  try {
    const prev = readIdentity(key);
    const next: CachedIdentity = {
      v: 1,
      savedAt: Date.now(),
      key,
      identity: partial.identity ?? prev?.identity ?? { authoritative: false },
      standing: partial.standing ?? prev?.standing,
      readiness: partial.readiness ?? prev?.readiness,
    };
    window.localStorage.setItem(KEY_PREFIX + key, JSON.stringify(next));
  } catch {
    // quota exceeded, private mode, etc. — cache is best-effort
  }
}

export function clearIdentity(key: string): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(KEY_PREFIX + key); } catch {}
}
```

**Design notes:**
- **Sync read.** No `await`, no Promise. Called during `useState` lazy init, so
  first paint has the cached value without an intermediate render.
- **TTL is "cache miss", not "stale."** When the cache entry is too old we
  return `null` and let SSE populate fresh state. This avoids mis-mapping to
  the `stale` trust label, which has its own meaning (decision-grade but aging
  evidence).
- **Key is the NPI or entityId.** Same key space as `useIngestStream.startIngest(npi)`.
- **SSR safety.** `typeof window === 'undefined'` check so the module is
  import-safe from Next.js server components.
- **Version field `v: 1`.** Any future breaking change to the stored shape
  bumps this and silently invalidates old entries.

### 2. `passportToStreamSeed.ts` — the SSR bridge

```ts
// apps/web/lib/hybrid-loader/passportToStreamSeed.ts
// Pure function. Unit-tested. No React. No storage.

import type { PassportData } from '@/lib/trust/passport-contract';
import type { IngestStreamState } from '@/hooks/ingestStreamState';
import { createInitialIngestStreamState } from '@/hooks/ingestStreamState';

/**
 * Map a server-fetched PassportData into an IngestStreamState that the
 * client hook can use as its initial state. This is the SSR → client bridge.
 *
 * We only populate the fields that PassportData actually knows about at
 * the moment of the fetch. Fields that PassportData cannot provide
 * (e.g. raw NPPES taxonomies) stay undefined; SSE will fill them later.
 */
export function passportToStreamSeed(passport: PassportData): IngestStreamState {
  const base = createInitialIngestStreamState();

  return {
    ...base,
    phase: 'done',
    npi: passport.npi,
    anchorEntityId: passport.entityId,
    isUsable: true,
    identity: {
      entityId: passport.entityId,
      displayName: passport.identity.displayName,
      specialty: passport.identity.specialty,
      entityType: passport.identity.entityType,
      status: passport.identity.status,
      authoritative: passport.identity.status?.toUpperCase() !== 'UNKNOWN',
    },
    standing: {
      exclusionChecked: passport.standing.exclusionStatus !== 'UNCHECKED',
      exclusionClear: passport.standing.exclusionClear,
      exclusionStatus: passport.standing.exclusionStatus,
      enrollmentChecked: passport.standing.pecosEnrollmentStatus !== 'UNCHECKED',
      enrollmentStatus: passport.standing.pecosEnrollmentStatus,
    },
    // readiness is filled from passport.readiness if present
    readiness: {
      score: passport.readiness?.score,
      level: passport.readiness?.level,
      status: passport.readiness?.status,
    },
    // sources: mark everything done if the SSR payload has values for them
    sources: {
      nppes: passport.identity.displayName ? 'done' : 'pending',
      oig: passport.standing.exclusionStatus !== 'UNCHECKED' ? 'done' : 'pending',
      pecos: passport.standing.pecosEnrollmentStatus !== 'UNCHECKED' ? 'done' : 'pending',
    },
  };
}
```

**Design notes:**
- **Pure function.** Easy to unit-test with fixture `PassportData`.
- **Seeds `phase: 'done'`.** Because the server returned a complete snapshot,
  the initial phase reflects "done from cache/server" — SSE will override it
  if a new run starts.
- **Conservative `authoritative` flag.** Uses the same `!== 'UNKNOWN'` rule
  that `isAuthoritativeIdentity` uses at `ingestStreamState.ts:165-179`.
- **No readiness normalization** — we pass through whatever `PassportData`
  has. If the review page didn't fetch readiness, the hook still renders
  identity, and the UI badge for readiness is `pending`.

### 3. `useHybridProviderData.ts`

```ts
// apps/web/hooks/useHybridProviderData.ts
'use client';

import { useEffect, useRef } from 'react';
import { useIngestStream } from '@/hooks/useIngestStream';
import type { IngestStreamState } from '@/hooks/ingestStreamState';
import { readIdentity, writeIdentity } from '@/lib/hybrid-loader/identityCache';

export interface HybridProviderDataInput {
  /** Canonical key — NPI for public surfaces, entityId for authenticated surfaces */
  key: string;
  /** Server-rendered seed, if available (e.g. /review). Wins over cache on first paint. */
  ssrSeed?: IngestStreamState | null;
  /** Whether to automatically start an SSE ingest on mount. Default: true. */
  autoStart?: boolean;
}

export function useHybridProviderData({
  key,
  ssrSeed,
  autoStart = true,
}: HybridProviderDataInput) {
  // Lazy init — runs once, synchronously. Precedence: SSR > cache > empty.
  const initialState = useRef<IngestStreamState | undefined>(undefined);
  if (initialState.current === undefined) {
    if (ssrSeed) {
      initialState.current = ssrSeed;
    } else {
      const cached = readIdentity(key);
      initialState.current = cached
        ? hydrateFromCachedIdentity(cached)
        : undefined;
    }
  }

  const hook = useIngestStream(initialState.current);

  // Write-through cache: persist only authoritative state.
  useEffect(() => {
    if (!hook.state.isUsable) return;
    writeIdentity(key, {
      identity: hook.state.identity,
      standing: hook.state.standing,
      readiness: hook.state.readiness,
    });
  }, [key, hook.state]);

  // Auto-start SSE if we have a key and no authoritative data yet, OR if the
  // seed/cache is present but we want to refresh in the background.
  useEffect(() => {
    if (!autoStart) return;
    if (!key) return;
    // Only auto-start if we have an NPI shape (public ingest only runs on NPI)
    if (!/^\d{10}$/.test(key)) return;
    // Fire and forget — the hook mutex'es duplicate calls.
    void hook.startIngest(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, autoStart]);

  return hook;
}
```

**Design notes:**
- **Lazy-init via ref, not `useState` initializer.** `useIngestStream` already
  does `useState(() => initialState ?? createInitialIngestStreamState())` at
  `useIngestStream.ts:51-53`, so we pass our computed seed in and let the
  existing lazy init handle it.
- **`autoStart: true` by default.** `/review` passes `autoStart: true` so the
  server payload gets immediately refreshed via SSE. `/passport` can continue
  to call `startIngest` manually by passing `autoStart: false`.
- **Only auto-starts on NPI-shaped keys.** EntityId-keyed callers don't trigger
  the public SSE run automatically.
- **Write-through on every state update where `isUsable=true`.** Cheap enough
  — localStorage writes take microseconds — and guarantees the cache is never
  stale within a session.

---

## SSR → client wiring in `/review`

Current flow (`app/review/[entityId]/ReviewPageClient.tsx`):

```
[server] fetchBackendJson<PassportData>('/api/passport/...')
   │
   ▼
[server] <ReviewClient passport={passport} ... />
   │
   ▼
[client] ReviewClient renders passport statically
```

New flow:

```
[server] fetchBackendJson<PassportData>('/api/passport/...')
   │
   ▼
[server] <ReviewClient passport={passport} hybridSeed={passportToStreamSeed(passport)} ... />
   │
   ▼
[client] ReviewClient:
           const { state } = useHybridProviderData({
             key: passport.npi ?? passport.entityId,
             ssrSeed: hybridSeed,
             autoStart: Boolean(passport.npi),
           });
           // Static render still uses `passport` prop (credentials, proof).
           // Live overlay uses `state.identity` + `state.sources` for the
           // "Checking…" / "Updated just now" header badge.
```

**Why keep `passport` prop AND the hook state?** Because `PassportData` contains
authoritative server-owned data (credentials, proof panels, acceptance history)
that we do NOT want to cache in localStorage. The hook state is a narrow
"identity + freshness" overlay. They coexist.

**`passportToStreamSeed` runs on the server.** It's a pure function that takes
`PassportData` and returns a plain object — no React, no storage, safe to run
at the `ReviewPageClient.tsx` server component boundary. Serializing the
result into the client prop graph is free (it's just JSON).

---

## UI state copy

No new labels. Using existing ones from `apps/web/lib/trust/status-language.ts`:

| Condition | Badge | Source |
|---|---|---|
| First paint from SSR or cache, SSE hasn't reported anything yet | `pending` → "Loading" | status-language.ts:60 |
| SSE `source_start` is in-flight | `pending` → "Checking…" *(new SAFE_DISPLAY_LABEL)* | status-language.ts:96 |
| `state.isUsable && Date.now() - readyAt < 10_000` | `verified` → "Updated just now" *(new SAFE_DISPLAY_LABEL)* | status-language.ts:91 |
| `state.isUsable && Date.now() - readyAt ≥ 10_000` | `verified` → "Source-backed" | status-language.ts:92 |
| SSE errored AND cache hit | `verified` with a muted "offline" affordance; cached data still wins | — |
| SSE errored AND cold (no cache, no seed) | `unavailable` → "Unavailable" | status-language.ts:102 |

**Two new SAFE_DISPLAY_LABELS** added in `status-language.ts`: `"Checking…"`
(under `pending`) and `"Updated just now"` (under `verified`). These are the
only copy additions. Everything else stays identical.

---

## Merge precedence (when SSR, cache, and SSE disagree)

The hook has a single reducer (`applyIngestEvent`), so merging is handled for us
as long as we seed the initial state correctly. The precedence is:

1. **SSE, once `isUsable=true`** — wins on all fields it provides. Server-truth.
2. **SSR seed (ssrSeed)** — beats cache on first paint. It's also server-truth,
   just frozen at fetch time.
3. **Cache (localStorage)** — only used when no SSR seed.
4. **Nothing** — if cold, first paint is `createInitialIngestStreamState()`.

Field-level: the existing `mergeIdentity`/`mergeStanding`/`mergeReadiness`
helpers at `ingestStreamState.ts:181-256` already do `readString(payload, key)
?? prev.field` — i.e. SSE wins when it has a value, prev (seed/cache) wins
otherwise. No new merge code is needed.

---

## Offline behavior

- `readIdentity` is pure localStorage read — works offline.
- `useIngestStream.startIngest` will fail on `fetch` (no network). That triggers
  its existing error path at `useIngestStream.ts:124-135`, which sets `phase:
  'error'` but **does not clear the cached identity**, because `applyIngestEvent`'s
  error branch at `ingestStreamState.ts:525-542` explicitly preserves `isUsable=true`
  state.
- The user sees cached identity with an "offline" muted affordance. No blank
  screen, no error toast.

This is a free win from the existing `ingestStreamState` reducer — we don't
have to write special offline logic.

---

## Testing strategy

### `identity-cache.test.ts` (~100 LOC)
- `readIdentity` returns `null` on cache miss
- `readIdentity` returns `null` on TTL expiry (mock `Date.now`)
- `readIdentity` returns `null` on version mismatch (`v !== 1`)
- `readIdentity` returns `null` on malformed JSON
- `writeIdentity` round-trips identity/standing/readiness
- `writeIdentity` is a no-op when localStorage throws (private mode)
- `clearIdentity` removes the key
- All methods are no-ops under SSR (`typeof window === 'undefined'`)

### `passport-to-stream-seed.test.ts` (~80 LOC)
- Fixture `PassportData` with full identity → seed with `phase: 'done'`, `isUsable: true`
- Fixture with `identity.status === 'UNKNOWN'` → `authoritative: false`
- Fixture with `standing.exclusionStatus === 'UNCHECKED'` → `sources.oig: 'pending'`
- Fixture without NPI → seed `npi: undefined`, still usable via `entityId`
- Pure function: same input produces same output (no clocks, no I/O)

### `use-hybrid-provider-data.test.tsx` (~120 LOC)
- First render with `ssrSeed` renders identity immediately (no waiting)
- First render with cache hit (no SSR seed) renders identity immediately
- First render with neither renders empty state
- `state.isUsable=true` triggers `writeIdentity`
- Every subsequent authoritative state update writes through to cache (cheap — sub-ms localStorage.setItem)
- `autoStart: true` calls `startIngest` when key is NPI-shaped
- `autoStart: true` does NOT call `startIngest` when key is entityId-shaped
- Offline (fetch throws) preserves cached identity in state

### Integration test extension for `/review`
- Update `__tests__/review-page-contract.test.tsx` to assert that a render of
  `ReviewClient` with a mock `PassportData` + seed produces the "Updated just
  now" badge and the displayName on first paint (no `waitFor`).

**All tests use vitest**, matching the rest of the `apps/web/__tests__/` folder.

---

## Risk table

| Risk | Likelihood | Mitigation |
|---|---|---|
| localStorage quota exceeded | Low | try/catch wraps writes; cache is best-effort |
| Cached identity is stale (provider changed name) | Low | 24h TTL; SSE overwrites on first successful run |
| PII in localStorage is visible to shared-device users | Medium | Documented trade-off — user explicitly chose localStorage for sync semantics. NPI + name are already public data (PECOS, NPPES). Nothing PHI. |
| SSR seed shape drifts from `IngestStreamState` | Medium | `passportToStreamSeed` is a pure function with its own unit tests; a schema change in `PassportData` will break those tests immediately |
| `/passport`'s existing `initialState` semantics change | Low | We're not modifying `useIngestStream`; we just pass the existing parameter |
| Cache key collision across tenants/users | Low | Key is NPI/entityId only. Public-surface data only — no tenant scoping needed. If this gets reused for authenticated views, add tenant prefix later. |

---

## Out-of-scope (deferred)

- **Cache invalidation on authoritative mutations** (e.g. admin re-runs ingest).
  Deferred to a follow-up; 24h TTL is sufficient for the launch use case.
- **IndexedDB migration.** Only if we ever need to cache >5MB of provider lists.
- **Service Worker offline mode.** Out of scope; localStorage covers the "reload
  renders instantly" requirement.
- **Applying to provider profile surfaces.** Those don't exist yet. When they
  land, they adopt `useHybridProviderData` as-is.
- **`/passport` cache opt-in.** Not in this PR. `/passport` continues to call
  `useIngestStream` directly; the wrapper becomes available for future opt-in.
  This keeps the PR focused on `/review` and the new primitives.

---

## Definition of done

- [x] Spec approved
- [ ] 3 new files created under `apps/web/lib/hybrid-loader/` and `apps/web/hooks/`
- [ ] 3 new test files under `apps/web/__tests__/`
- [ ] `apps/web/components/review/ReviewClient.tsx` wired to `useHybridProviderData`
- [ ] `status-language.ts` adds `"Checking…"` and `"Updated just now"` to `SAFE_DISPLAY_LABELS`
- [ ] `pnpm --filter web test` passes with new test files
- [ ] `pnpm --filter web build` passes (no TS/ESLint errors — `next.config.mjs` enforces this)
- [ ] Manual verification: visit `/review/1234567890`, reload, confirm identity is visible on first paint (no flicker)
- [ ] Manual verification: DevTools → Network → offline, reload, confirm identity still renders
- [ ] `useIngestStream.ts` unchanged (`git diff main -- apps/web/hooks/useIngestStream.ts` is empty)
- [ ] PR opened against `main`
