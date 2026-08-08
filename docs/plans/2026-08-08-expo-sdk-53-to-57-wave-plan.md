# Expo SDK 53 → 57 wave — plan

**Status:** proposal, awaiting founder decision. Nothing here has been executed.
**Scope:** `apps/mobile` (`@vitalcv/mobile-wallet`) only.
**Origin:** the deliberate loose end left by the
[Dependabot backlog triage](../security/dependabot-backlog-triage-2026-08-07.md) —
PR #582 (`expo-notifications` 0.31.5 → 57.0.8) was closed and majors ignored
(#1135) precisely because a single-package bump across an SDK boundary merges as
text and breaks as software. This is the wave that pays that debt.

---

## 1. Verdict up front

**Classification: maintenance / infrastructure. Not product.**

Run honestly through
[`product-decision-filter.md`](../strategy/product-decision-filter.md), this
strengthens none of the seven criteria — not time-to-a-useful-profile, role
relevance, repeated data entry, clinician-controlled sharing, employer
acceptance, successful starts, or profile reuse. `apps/mobile` is not shipped to
any store, `isLive: false` on the completion board, and no clinician has ever
opened it. Nothing in this wave reaches a customer.

**Recommendation: do it, in four sequential PRs, but only after adding CI
coverage first — and do not dress it as product work.**

The argument for doing it *now* rather than later is cost, not value: the app is
currently 5 live route files and 3 test files. Every SDK the tree falls behind
makes the eventual upgrade more expensive, and this app's dependency set is
about as small as it will ever be. The argument against is that a wave spent
here is a wave not spent on the reusable clinician profile. That trade is the
founder's call, and §8 states it plainly.

---

## 2. Current state — measured, not assumed

Everything in this section was verified against `origin/main` on 2026-08-08.

| Fact | Value |
|---|---|
| `expo` | `~53.0.0` |
| `react-native` | `0.79.6` |
| `react` | `19.0.0` |
| Baseline `tsc --noEmit` | **exit 0** (clean) |
| Baseline test suite | **9/9 passing**, 3 files, 584 ms |
| `apps/mobile/ios/`, `apps/mobile/android/` | do not exist, **never committed** |
| `eas.json` | does not exist **anywhere in the repo** |
| `newArchEnabled` in `app.json` | **not set** |
| CI jobs executing anything in `apps/mobile` | **zero** |
| Store presence | none — completion board: `isLive: false`, "nothing shipped to devices" |
| `VALIDATION.md` | "AWAITING EXECUTION — human required" |

**Live routes** (5): `app/_layout.tsx`, `app/onboarding.tsx`,
`app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/readiness.tsx`.

**Archived** (5, under `app/_archive/wallet-era/`): `wallet`, `present`, `scan`,
`settings`, `credential-detail`. `expo-router` ignores `_`-prefixed directories,
so these are unreachable at runtime — but `tsc` still compiles them, so they
still constrain the upgrade.

### Why CI coverage is zero

Every CI invocation in `.github/workflows/ci.yml` is either
`--filter @vitalcv/web` or `--filter='!@vitalcv/web'`. The latter looks like it
should include mobile, but `@vitalcv/mobile-wallet` declares **no `build`
script** — only `start`, `android`, `ios`, `web`, `typecheck`, `test`. Turbo
therefore has nothing to run for it, and `typecheck`/`test` are never invoked
repo-wide. The mobile suite has never executed in CI.

This is the single most important planning fact. It is exactly the case
`CLAUDE.md` warns about: *"Green CI is not evidence the code works."* For this
app there is no CI at all, so **100% of verification in this wave is manual
unless we change that first.**

---

## 3. A real bug found while planning — independent of the upgrade

`apps/mobile/src/services/NotificationService.ts:88-91` schedules expiry
reminders with:

```ts
trigger: {
  channelId: 'credential-alerts',
  date: reminderDate,
}
```

This does not schedule anything. It fires immediately.

**Why the types allow it.** `NotificationTriggerInput` is the union
`null | ChannelAwareTriggerInput | SchedulableNotificationTriggerInput`.
`ChannelAwareTriggerInput` is `{ channelId: string }` — documented as *"a trigger
that will cause the notification to be delivered immediately."* Our object
structurally satisfies it. The stray `date` survives excess-property checking
because TypeScript permits a property present in *any* member of the union, and
`date` exists on `DateTriggerInput`. So `tsc` passes.

**Why it fails at runtime.** In `scheduleNotificationAsync.js`, `parseDateTrigger`
requires `'type' in trigger && trigger.type === SchedulableTriggerInputTypes.DATE`.
Ours has no `type`, so every parser returns `undefined` and `parseTrigger` falls
through to:

```js
return Platform.select({
  default: null,                                    // iOS → immediate
  android: { type: 'channel', channelId: ... },     // Android → immediate
});
```

The `date` is silently discarded. A clinician with one expiring credential would
receive all three reminders — "expires in 90 days", "in 30 days", "in 7 days" —
in the same instant, and never again.

**Severity today: latent, not live.** The only caller is
`WalletSyncService.sync()`, and the only callers of *that* are
`app/_archive/wallet-era/{settings,wallet}.tsx` — archived, unrouted. No live
route reaches it. The correct reading is not "harmless" but **"armed"**: it
detonates the moment someone builds the notification surface that `ROLE.md`
lists as *"(future)"*, which is precisely the next thing anyone would do here.

**Fix** (one line plus an import):

```ts
trigger: {
  type: Notifications.SchedulableTriggerInputTypes.DATE,
  channelId: 'credential-alerts',
  date: reminderDate,
}
```

Recommended as **step 0b**, before any SDK movement, so it lands as an isolated,
reviewable behavioural fix rather than being buried in an upgrade diff.

---

## 4. Why this cannot be one jump

Expo's own upgrade guidance is explicit: **upgrade one SDK version at a time.**
Two independent reasons make that binding here rather than advisory:

1. **SDK 55 removes the Legacy Architecture entirely.** SDK 54 is the last
   release that supports it. Crossing 54→55 is an architecture migration, not a
   version bump.
2. **SDK 56 forks `expo-router`.** The navigation dependency tree changes
   fundamentally, which makes a 54→56 skip unreliable by construction.

A single `expo install --fix` to 57 would cross both boundaries blind, with no
CI, on an app that has never been built natively. That is the #808 mistake
(forcing a single package across a major, reverted by #812) repeated at four
times the scale.

---

## 5. The four steps

Per-step exposure below is **our** exposure, measured against our source — not a
general changelog summary.

### Step 1 — SDK 53 → 54 (RN 0.81, React 19.1)

| Upstream change | Our exposure |
|---|---|
| JSC no longer bundled | **None** — Hermes is the default engine |
| `expo-file-system` default export replaced by the former `/next` | **None** — 0 files import it |
| Reanimated v4 (New Arch only) | **None directly** — 0 imports; verify transitives via `react-native-screens` |
| `expo-notifications` deprecated exports removed | **Verify** — we use `getPermissionsAsync`, `requestPermissionsAsync`, `scheduleNotificationAsync`, `setNotificationChannelAsync`, `cancelAllScheduledNotificationsAsync`, `AndroidImportance`. All current API, expected clean |
| `notification` field in `app.json` deprecated | **None** — we have no such key |
| Metro internal imports | **None** — no custom Metro config |

Assessment: **lowest-risk step.** Mostly a version bump for us.

### Step 2 — SDK 54 → 55 (Legacy Architecture removed)

| Upstream change | Our exposure |
|---|---|
| **New Architecture mandatory** | **The real risk — see below** |
| `notification` field now *errors* in prebuild | None — no such key |
| Expo Go push on Android throws instead of warning | None — no push configured |
| `expo-notifications` Firebase/Android fixes | Neutral-to-positive |

**This is the hard step, and its risk is not in the diff.** `newArchEnabled` is
unset today, and the app has never been prebuilt or built natively — no `ios/`,
no `android/`, no `eas.json`, none ever committed. So New Architecture
compatibility for `react-native-svg 15.11.2`, `react-native-qrcode-svg 6.3.15`,
`react-native-screens ~4.11.1` and `react-native-safe-area-context 5.4.0` has
**never been exercised in this repo, at any point.**

`tsc` and vitest cannot detect a New Arch failure. It surfaces only in a native
build or on a device. This is the step that decides whether the wave needs a
build path (§7).

### Step 3 — SDK 55 → 56 (RN 0.85, React 19.2)

| Upstream change | Our exposure |
|---|---|
| **`expo-router` fork drops `@react-navigation/*` imports in app code** | **`app/_layout.tsx:1` — a LIVE route.** `import { DarkTheme, ThemeProvider } from '@react-navigation/native'` must be repointed to the `expo-router` entry point, and the direct `@react-navigation/native` dependency dropped |
| `@react-native-vector-icons/*` scoped packages | **3 files, all archived** — `_archive/wallet-era/{settings,wallet,credential-detail}.tsx` import `Ionicons` from `@expo/vector-icons`. Forces the archive decision in §8 |
| iOS minimum → 16.4 | Config only; no store presence to break |
| Hermes V1 default | Neutral |
| Reanimated +25–30% memory under Hermes V1 | **None** — reanimated not used |
| Precompiled React-Core on iOS | Only bites if we add a native build |

Assessment: **the most code churn**, but all of it small and mechanical.

### Step 4 — SDK 56 → 57 (RN 0.86, React 19.2)

Expo describes this as intentionally small — RN 0.85 → 0.86 with no intended
breaking changes, React unchanged at 19.2. Expect a near-clean
`expo install --fix`. This is also the step that **removes the `ignore` entry
from `.github/dependabot.yml`** added by #1135.

---

## 6. Per-step procedure (identical each time)

Learned from #1031, which is the only precedent in this repo that worked:

```bash
git fetch origin main
git worktree add -b claude/expo-sdk-<n> /tmp/vitalcv-expo-<n> origin/main
cd /tmp/vitalcv-expo-<n>
pnpm install

# 1. move the SDK, let Expo align the companion set — never hand-edit versions
pnpm --filter @vitalcv/mobile-wallet exec expo install expo@~<n>.0.0
pnpm --filter @vitalcv/mobile-wallet exec expo install --fix

# 2. MANDATORY: re-normalise the lockfile (see gotcha below)
pnpm install

# 3. verify
pnpm --filter @vitalcv/mobile-wallet exec tsc --noEmit
pnpm --filter @vitalcv/mobile-wallet exec vitest run --config vitest.config.ts
pnpm --filter @vitalcv/mobile-wallet exec expo-doctor
pnpm install --frozen-lockfile     # proves CI will not ERR_PNPM_OUTDATED_LOCKFILE
```

**The #1031 gotcha, which will recur at every step.** Expo's embedded install
writes the `apps/mobile` importer with pre-override specifiers (e.g.
`@types/react ^19.0.14` against the root pnpm override's `^19`), which
`ERR_PNPM_OUTDATED_LOCKFILE`s *every* frozen-lockfile CI job in the repo — not
just mobile's. A plain `pnpm install` re-normalises it. Budget for hitting this
four times.

**Expected acceptance per step:** `tsc` exit 0, 9/9 tests, `expo-doctor` clean,
`--frozen-lockfile` clean, and the lockfile importer diff confined to
`apps/mobile`.

---

## 7. The verification problem, and step 0

`tsc` + 9 tests is the entire automated signal available, and today **neither
runs in CI**. What that signal cannot see:

- native build success (no build path exists)
- New Architecture runtime behaviour (step 2's actual risk)
- `expo-router` navigation actually working after the SDK 56 fork
- notification delivery (the §3 bug is invisible to `tsc` by construction —
  that is *how* it survived)

### Step 0a — add mobile to CI (strongly recommended, cheap)

Add a job to `.github/workflows/ci.yml` running mobile `typecheck` + `test`.
Cost: a few seconds of runner time — the suite is 584 ms and `tsc` is fast.
Benefit: converts four blind upgrades into four gated ones, and closes a gap
that exists today regardless of whether this wave ever runs.

This is worth doing **even if the founder defers the whole wave.**

### Step 0b — fix the notification trigger bug (§3)

Isolated, one-line, reviewable. Ahead of the SDK moves so it is not buried.

### The build-path question

Whether to add `eas.json` + a development build is a genuine fork in the plan:

- **Without it:** steps 1–4 are verifiable only to the JS layer. Step 2's New
  Arch risk ships unverified. Honest, cheap, and arguably proportionate for an
  app with no users — but the wave must then *say* it did not verify natively
  rather than implying green means working.
- **With it:** real verification, at the cost of EAS setup, credentials, and
  build minutes for an app with no store presence.

Given `isLive: false` and zero users, **the JS-only path is defensible** —
provided the limitation is stated in the PR rather than glossed. Recommend
deferring the native build until there is an actual intent to ship, and
recording that decision here.

---

## 8. Decisions needed before execution

1. **Is this wave worth running now?** It is maintenance on an unshipped app.
   Deferring is a legitimate answer; the cost of deferring is that the gap grows.
2. **The `_archive/wallet-era` directory** — delete it or migrate it? Five dead
   files that are nonetheless the only consumer of `@expo/vector-icons` (SDK 56
   work) and the only path that reaches the §3 notification bug. Deleting is
   cheaper and shrinks the upgrade surface; it also discards the wallet-era
   implementation the MOBILE_AUDIT calls "complete". **Recommendation: delete**,
   since git history preserves it and `ROLE.md` explicitly forbids mobile being
   a wallet.
3. **Native build path** — accept JS-only verification (recommended) or add EAS?
4. **Step 0a (mobile CI)** — approve independently of the rest of the wave?

---

## 9. Sequencing and effort

| Step | Content | Risk | Verification available |
|---|---|---|---|
| 0a | Mobile `typecheck` + `test` in CI | Very low | The job itself |
| 0b | Notification trigger fix | Low | `tsc`, tests, code read |
| 1 | SDK 53 → 54 | Low | `tsc`, tests, `expo-doctor` |
| 2 | SDK 54 → 55 (**New Arch**) | **High** | JS only unless a build path is added |
| 3 | SDK 55 → 56 (router fork, icons) | Medium | `tsc` catches both changes |
| 4 | SDK 56 → 57 + remove the `dependabot.yml` ignore | Low | `tsc`, tests, `expo-doctor` |

Six PRs, each independently revertible. Steps 0a and 0b can land immediately and
are useful on their own merits. **Do not `expo install --fix` straight to 57.**

---

## 10. Definition of done

- `apps/mobile` on `expo ~57.0.0` with the companion set aligned by
  `expo install --fix`
- `tsc --noEmit` exit 0; 9/9 tests; `expo-doctor` clean
- `pnpm install --frozen-lockfile` clean, lockfile importer diff confined to
  `apps/mobile`
- Mobile `typecheck` + `test` running in CI
- The `expo-notifications` `ignore` entry removed from `.github/dependabot.yml`
- The §3 trigger bug fixed
- **Stated explicitly in the final PR:** whether native/New-Arch verification was
  performed or deliberately skipped. No claim that the app "works" on the
  strength of `tsc` and 9 unit tests.

---

## Sources

Upstream behaviour cited above comes from Expo's changelogs and upgrade
guidance; our exposure was measured against this repo.

- [Expo SDK 54 changelog](https://expo.dev/changelog/sdk-54)
- [Expo SDK 55 changelog](https://expo.dev/changelog/sdk-55)
- [Expo SDK 56 changelog](https://expo.dev/changelog/sdk-56)
- [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57)
- [Upgrade Expo SDK walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [React Native's New Architecture](https://docs.expo.dev/guides/new-architecture/)
- [Expo Go and the App Store, May 2026](https://expo.dev/changelog/expo-go-and-app-store-may-2026)
