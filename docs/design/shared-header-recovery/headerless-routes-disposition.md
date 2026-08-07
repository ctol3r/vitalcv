# Headerless public routes — sweep disposition (2026-08-07)

Follow-up to [gap-analysis §8.4](./gap-analysis.md). The registry
(`apps/web/components/layout/publicSurfaceRoutes.ts`) matches exact paths plus
listed prefixes, and `Navbar`/`Footer` both return `null` off it — so registry
membership IS the chrome decision. A full enumeration (156 served routes)
found **56 public routes rendering headerless**. Classification below;
`__tests__/public-surface-registry.test.ts` pins both the additions and the
deliberate exclusions.

## A. Chrome owed — added by this sweep (5)

| Route | Why |
|---|---|
| `/pricing` | Sitemap-indexed marketing (priority 0.6), linked from `/concierge`, rendered navless. The headline defect. |
| `/directory/[npi]` | The indexable NPPES registry page (JSON-LD + canonical). A search visitor landed with no way into the site. |
| `/profile/[npi]` | The career profile a clinician deliberately shares — the recipient now gets the site chrome around it. |
| `/investigate/[npi]` | Public diligence surface; the survivability registry declares it `public: true`. |
| `/concierge` | Sellable offer page; nothing linked to it and it rendered navless. |

## B. Deliberately chromeless — excluded on purpose (14)

`/auth/error` · `/auth/resolving` (redirect interstitials; the second is a
middleware target) · `/apply/[requestUri]` (transaction landing; legacy-bundle
error branch still links `/passport` — flagged) · `/onboarding/{identity,
readiness,fetching}` (dark full-viewport StepShell composition; the parent
`/onboarding` IS chromed — the asymmetry is intentional) ·
`/receipt/[receiptId]` · `/snapshot/[id]` (standalone printable/QR evidence
artifacts, self-contained mastheads) · `/dev/{career-garden,graph/[entityId],
matcha-deck,matcha-workspaces,page-stack,story-rail}` (flag-gated fixture
harnesses; `notFound()` in production).

## C. Self-guarded internal — registry/middleware question, not chrome (6)

`/ops` · `/ops/survivability` · `/admin/leads` · `/admin/platform` inline-guard
with `auth()`. **`/admin/demo-reset` finding CLOSED** — it shipped with no
guard at all; fixed by [#1100](https://github.com/ctol3r/vitalcv/pull/1100)
(merged `c65ec700b`): sibling-pattern inline `auth()` + ADMIN check on the
page, plus a `/^\/admin(\/.*)?$/ → ADMIN` prefix guard in `PROTECTED_ROUTES`
so the whole tree is middleware-covered.
`/clinician/profile` guards client-side only (Clerk `useUser`) and is linked
exclusively from signed-in surfaces.

## D. Orphaned / legacy — retirement wave ordered by the founder (22)

- **12 foundation-doc spec pages** (one shared template, zero inbound links,
  copy self-describes as "foundation only"): `/account/recovery`,
  `/analytics-foundation`, `/support`, `/clinician/device-security`,
  `/clinician/identity`, `/clinician/identity/verification`,
  `/clinician/import`, `/clinician/import/professional`,
  `/clinician/mobile-capture`, `/clinician/profile-layers`,
  `/clinician/research`, `/mobile/native-readiness`.
- **6 fixture demo dashboards** (zero inbound; `/inbox` shadowed by the real
  `/verifier/inbox`; `/dossier` carries retired vocabulary): `/autopilot`,
  `/roi`, `/inbox`, `/file/[fileId]`, `/dossier/[receiptId]`,
  `/activation/[caseId]`.
- **4 redirect stubs** (aliases, to be handled with URL-compat care in the
  retirement wave): `/clinician/graph`, `/clinician/onboarding`,
  `/onboarding/success` (still a live CTA target — `ReadinessCard.tsx:81`
  must be re-pointed first), `/signup`.

## E. Decided 2026-08-07 (founder-delegated) (9)

- The **8 WorkspaceNav entity surfaces** (`/activity`, `/career-intelligence`,
  `/career-map`, `/ecosystem`, `/packet`, `/professional-growth`,
  `/recruiter/candidate`, `/search/[entityId]`): **nest under the site
  header.** One navigation model — the shared header is the global chrome,
  the pill-nav is local secondary navigation; the `/demo` → entity chrome
  cliff is healed. Implemented via `PREFIX_MATCHERS`.
- `/status/technical`: **stays a bare standalone console — deliberately in
  neither chrome class.** Public chrome would put the paper journey header
  over a dark mono console (scene-system violation); ops classification was
  evaluated and REJECTED because the ops shell mounts `VCommandBar` —
  ungated intelligence tooling — which must not appear on a publicly
  reachable route. Pinned three ways in
  `__tests__/public-surface-registry.test.ts`.

Notable side-findings: `/support` and `/status/technical` were both named as
chrome candidates in gap-analysis §8.4 and turned out to be a spec shell
(bucket D) and an ops console (bucket E) — neither was silently chromed.
