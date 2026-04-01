# VitalCV Product Evaluation — Pilot Readiness

**Date:** 2026-03-30
**Standard:** Could this close a pilot conversation?
**Evaluator:** Product review (not code review)

---

## Top 7 UX Breakdowns

**1. Selective Disclosure runs on hardcoded demo credentials.**
`CredentialPresentationActions.tsx` uses `DEMO_CREDENTIALS` and `DEMO_CLAIM_FIELDS` with IDs like `cred-demo-001`. A clinician clicking "Create Presentation" will either see fake data or hit a wall when the demo IDs don't match their real wallet. The most advanced trust primitive VitalCV offers—selective disclosure—is the one most visibly fake.

**2. `/verify/[npi]` is a dead page.**
The entire public verification route renders: "Verification results will appear here." A clinician who shares a verification link sends an employer to a blank shell. This is the most externally visible failure point because it's the one URL that gets forwarded to people outside the system.

**3. Clinician dashboard state machine drops to "Set up your readiness" if the workspace API hiccups.**
The `/holder` page has three states: HAS_NPI, NO_NPI, ERROR. If `/api/me/workspaces` returns an error (timeout, 500, network blip), a returning clinician with a fully verified profile sees the onboarding prompt again. There is no retry, no cached state, no graceful degradation. The experience says "we forgot who you are."

**4. No credential-level "what to fix" guidance on the clinician side.**
The readiness surface shows a score, a delta, and a boolean checklist (NPI verified, resume uploaded, etc.). But when a credential is EXPIRED or SUSPENDED, there is no link, instruction, or next step. The clinician sees a red dot and a label. The employer review surface has "next actions" with explanatory text; the clinician surface does not. The person who needs to act has the least information about how to act.

**5. Onboarding is 3 steps but Step 3 (readiness) is inferred, not confirmed.**
Steps 1 (NPI entry) and 2 (identity verification) have explicit page routes. Step 3 is referenced in `StepShell` as "Step 3 of 3" but the actual `/onboarding/readiness` route is not present in the app directory. The progress bar shows 100% but the step may not exist. A clinician completing onboarding may hit a dead end or get silently redirected.

**6. State Board permanently shows "Access required" with no explanation.**
On the `/passport` ingest page, the fourth source row is hardcoded: `state="access_required"`. It never changes. There is no tooltip, no explanation of what "access required" means, no indication of whether this will ever resolve, and no user action to take. It sits alongside three sources that progressively resolve, making it look broken by comparison.

**7. Mobile bottom nav has 5 tabs but "Updates" (notifications) and "Wallet" (credentials) lead to surfaces that overlap heavily with "Ready" (readiness).**
The readiness surface shows credentials, score, and checklist. The wallet shows credentials and trust state. The home surface shows applications and readiness momentum. Three of five tabs show some version of "your credentials and how ready you are." A clinician in a pilot will tap between tabs and wonder what's different.

---

## Top 5 Trust Violations

**1. Demo credential IDs leak into production UI.**
`cred-demo-001`, `cred-demo-002`, `cred-demo-003` are string literals in a shipped component. If a clinician or employer inspects the page or sees a presentation JSON, they see "demo" in the credential IDs. This destroys the claim of cryptographic verifiability.

**2. AuditTimeline auto-generates fake hashes.**
`AuditTimeline.tsx` has `mockData: true` and deterministically generates hashes from event IDs. The component renders "Cryptographically Backed" as a badge while the hashes underneath are computed client-side from array indices. An auditor who checks the hash against any ledger will find nothing.

**3. Employer review says "Preview only" for any unauthenticated or non-employer user, but still renders the full decision surface with all clinician data.**
The passport data—identity, exclusion status, enrollment, credentials—is fully visible to anyone with the entity ID URL. The "Preview only" label at the bottom is the only gate. A pilot employer will ask: "If anyone with the link can see everything, what does 'trust' mean?" The selective disclosure promise is contradicted by the review page's open rendering.

**4. `holderNpi` defaults to `'1234567890'` in CredentialPresentationActions.**
If the component mounts without a real NPI prop, it silently uses a fake NPI for API calls. This means a presentation could be created against a non-existent provider and still return a "success" UI state if the backend doesn't validate.

**5. Freshness panel uses emoji characters (⚠, ✔, ○) as trust indicators.**
The `FreshnessPanel` and `ReviewTruthBucket` components use raw emoji and ASCII characters to signal trust states. This is not accessible (screen readers will read "warning sign"), renders inconsistently across platforms, and visually undermines the institutional gravity the rest of the design works hard to establish.

---

## Top 5 Strong Elements

**1. The employer review surface (`ReviewClient.tsx`) is genuinely excellent.**
The 6-question flow (Who is this? → Safe? → Licensed? → Eligible? → What blocks start? → What do I do?) is the best implementation of decision-support UX in a credentialing product I've seen described. It answers the right questions in the right order, with source attribution, freshness timestamps, and confidence context at every row. An employer can make a real decision here.

**2. The passport ingest SSE stream is a trust-building moment.**
Watching sources resolve progressively (NPPES → OIG → PECOS) with real-time status badges is dramatically more trustworthy than a spinner followed by a result page. The clinician sees the system doing work, not claiming results. This is the single best UX element in the product.

**3. Passkey-first authentication is the right call.**
No passwords. Face ID/Touch ID with magic link fallback. For a healthcare workforce product where users may onboard from a phone at a hospital, this is correct. It also aligns with the zero-trust posture—the auth mechanism matches the product thesis.

**4. The employer action panel writes audit events before confirming success.**
"VitalCV waits for the backend audit event before it renders success." This is not just UX copy—the code actually gates the UI state on the backend response. Accept, Request Refresh, and Route to Review are real actions with real persistence. The "Accept as head start (N blockers noted)" pattern honestly surfaces risk rather than hiding it.

**5. Readiness explanation card with 4-dimension breakdown.**
Identity, exclusion, licensure, enrollment—each with a percentage and a "what is missing" blockers list. This is structurally correct for healthcare credentialing. The dimensions map to real compliance requirements (NCQA, CMS, state boards), and the card communicates them without jargon.

---

## What Still Feels Fake or Theatrical

**Demo credentials in the selective disclosure modal** are the most obvious theatrical element. The feature is real in architecture but fake in presentation. A pilot clinician clicking "Create Signed Presentation" is performing a demo, not using a product.

**The "Cryptographically Backed" badge on AuditTimeline** when the hashes are generated client-side. This is theater—it's the trust equivalent of a security camera that isn't plugged in.

**"Estimated start: ~N days"** in the employer review, when there is no documented model for how this number is computed. If an employer asks "how did you get 3 days?" there is no answer. The precision implies a model that may not exist.

**The employer directory** (`/employers`) with trust scores, open roles counts, and "Verified" badges for employers. Unless these are populated from real employer data, this is a content shell that overpromises marketplace maturity.

**Five mobile nav tabs** for what is functionally a 2-screen product (my credentials + my readiness). The tab count signals a mature consumer app; the actual content signals an early pilot.

---

## Clinician Experience (1 paragraph)

A clinician entering VitalCV encounters a clean, calm onboarding: enter your NPI, watch sources resolve in real time, see your readiness score materialize. This is the product's strongest moment. After onboarding, the experience fragments. The dashboard shows a score and a checklist, but when something is wrong—an expired license, a failed exclusion check—the clinician gets a red dot and no guidance. The selective disclosure feature, which should be the clinician's primary trust tool, runs on demo data. The wallet, readiness, and home tabs all show overlapping views of the same information without clear differentiation. A pilot clinician will understand their score but not know what to do about it, and will not be able to share a working verification link because `/verify/[npi]` is empty. The experience earns trust at the front door and loses it the moment the clinician needs to act.

## Employer Experience (1 paragraph)

An employer reviewing a clinician through the `/review/[entityId]` surface gets the most coherent decision-support experience in the product. The 6-question trust stack (Identity → Safety → Authority → Eligibility → Blockers → Next Actions) is structurally sound, source-attributed, and timestamped. An employer can assess a clinician in under 60 seconds. The "Accept as head start" action with explicit blocker notation is honest and operationally useful. Where it breaks: the review page is fully visible to anyone with the URL regardless of authentication, the freshness indicators use emoji instead of institutional design language, and if the employer tries to verify something independently via `/verify/[npi]`, they hit a placeholder page. The review surface works; the trust perimeter around it does not.

---

## Verdict

| Dimension | Rating |
|-----------|--------|
| **Understanding** | **Clear** — Both clinician and employer can understand what VitalCV is showing them. The readiness score, trust stack, and source attribution communicate the product thesis without requiring explanation. |
| **Trust** | **Low** — Demo credential IDs, fake audit hashes, an empty verification page, and a review surface that exposes full passport data without authentication collectively undermine the "verified trust infrastructure" claim. The system tells you to trust it while showing you reasons not to. |
| **Usability** | **Theatrical** — The employer review surface is real. The passport ingest SSE is real. The clinician action surface, selective disclosure, public verification, and the credential wallet are theatrical—they look like a product but do not complete a real workflow end-to-end. |

### GO / NO-GO FOR PILOT

**NO-GO.** Three blockers must be resolved:

1. **Kill the demo data.** Remove `DEMO_CREDENTIALS`, `DEMO_CLAIM_FIELDS`, and the `holderNpi = '1234567890'` default. If selective disclosure can't run on real credentials yet, hide it. Showing a fake version of your core trust primitive is worse than not showing it at all.

2. **Ship or remove `/verify/[npi]`.** A blank verification page that's reachable via URL is an active credibility risk. Either connect it to the passport entity lookup (the data is there—`/review/[entityId]` already does this) or remove the route entirely.

3. **Gate the employer review surface behind authentication.** The passport data cannot be fully visible to anyone with a URL. The "Preview only" label is not a gate. At minimum, require Clerk auth to see credential details; show only identity + readiness band to unauthenticated viewers.

After those three, the product is close. The employer review surface is pilot-grade. The passport ingest is pilot-grade. The readiness score model is structurally correct. The gap is not architecture—it's exposed seams between real and theatrical that a pilot partner will find in the first session.
