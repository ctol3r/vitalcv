# VitalCV Truth Purge — 2026-04-09

> **Operator:** Claude Cowork  
> **Scope:** All buyer-facing, holder-facing, and marketing copy in `apps/web` and `apps/marketing`  
> **Live spine:** NPPES (always on), OIG/LEIE (always on), CMS PECOS (quarterly snapshot)  
> **Gated (NOT live):** Nursys, FSMB, STATE_BOARD, NPDB, DEA, ABMS, SAM.gov, Doximity

---

## Summary of Findings

| Severity | Count | Category |
|----------|-------|----------|
| **P0** | 5 | Claims about sources we don't have (DEA, SAM.gov, Board Cert, ABMS, Nursys in UI) |
| **P1** | 4 | Demo-theater spinners, misleading progress indicators |
| **P1** | 2 | Marketing copy implying "graph" or "zero-trust" language |
| **P0** | 1 | FSMB listed as live source in Hero.tsx source strip |
| **P2** | 2 | Stale copy in marketing site (verifier pages) |

---

## 1. `apps/web/components/marketing/Hero.tsx` — FSMB listed as live source

**File:** `apps/web/components/marketing/Hero.tsx`  
**Lines:** 59–76  
**Issue:** Source icons grid lists FSMB alongside NPPES, OIG/LEIE, and PECOS. FSMB requires an institutional agreement and is gated (`FSMB_ENABLED=false`). Showing it at equal weight implies live coverage.

### Replacement

```tsx
// OLD (lines 59–76):
<div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale">
  <div className="flex flex-col items-center gap-2">
    <Shield className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">NPPES</span>
  </div>
  <div className="flex flex-col items-center gap-2">
    <Shield className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">OIG/LEIE</span>
  </div>
  <div className="flex flex-col items-center gap-2">
    <Terminal className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">PECOS</span>
  </div>
  <div className="flex flex-col items-center gap-2">
    <Search className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">FSMB</span>
  </div>
</div>

// NEW:
<div className="mt-16 grid grid-cols-3 md:grid-cols-3 gap-8 opacity-40 grayscale">
  <div className="flex flex-col items-center gap-2">
    <Shield className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">NPPES</span>
    <span className="text-[8px] uppercase tracking-wider opacity-60">Identity</span>
  </div>
  <div className="flex flex-col items-center gap-2">
    <Shield className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">OIG/LEIE</span>
    <span className="text-[8px] uppercase tracking-wider opacity-60">Exclusion</span>
  </div>
  <div className="flex flex-col items-center gap-2">
    <Terminal className="w-5 h-5" />
    <span className="text-[10px] font-bold uppercase tracking-widest">PECOS</span>
    <span className="text-[8px] uppercase tracking-wider opacity-60">Enrollment (quarterly)</span>
  </div>
</div>
```

**Rationale:** Only show sources that are actually running. FSMB is gated and must not appear as a peer of live sources.

---

## 2. `apps/web/components/onboarding/ResolverProgressIndicator.tsx` — Fake DEA / Board Cert / "Trust Graph" steps

**File:** `apps/web/components/onboarding/ResolverProgressIndicator.tsx`  
**Lines:** 15–21  
**Issue:** The animated progress indicator shows "Verifying Board Certifications", "Checking DEA Registration", and "Generating Trust Graph" as resolution steps. None of these are live. Board cert verification requires ABMS (not integrated). DEA is not integrated. "Generating Trust Graph" implies a graph database we don't have. These spinners complete with green checkmarks, creating demo theater.

### Replacement

```tsx
// OLD (lines 15–21):
const DEFAULT_STEPS: ResolverStep[] = [
  { id: 'npi', label: 'Locating NPI record', icon: Database },
  { id: 'board', label: 'Verifying Board Certifications', icon: FileText },
  { id: 'dea', label: 'Checking DEA Registration', icon: Shield },
  { id: 'sanctions', label: 'Scanning Sanctions Database', icon: Zap },
  { id: 'graph', label: 'Generating Trust Graph', icon: Network },
];

// NEW:
const DEFAULT_STEPS: ResolverStep[] = [
  { id: 'npi', label: 'Resolving NPI identity (NPPES)', icon: Database },
  { id: 'sanctions', label: 'Running exclusion check (OIG/LEIE)', icon: Shield },
  { id: 'enrollment', label: 'Checking Medicare enrollment (PECOS)', icon: Zap },
];
```

**Rationale:** Only show steps that actually execute against live sources. Removed Board Cert (ABMS not integrated), DEA (not integrated), and "Generating Trust Graph" (implies graph DB). The import for `Network` and `FileText` can also be removed from the import line.

Also update the import:
```tsx
// OLD:
import { Check, Loader2, Database, Shield, Zap, FileText, Network } from 'lucide-react';

// NEW:
import { Check, Loader2, Database, Shield, Zap } from 'lucide-react';
```

---

## 3. `apps/web/lib/trust/homepage-public-truth.ts` — Licensure source label says "CA State Board / FSMB"

**File:** `apps/web/lib/trust/homepage-public-truth.ts`  
**Lines:** 66–77  
**Issue:** The licensure entry in the homepage truth strip says `name: 'CA State Board / FSMB'` and tooltip mentions "VitalCV currently supports CA via FSMB and is expanding." FSMB is gated. The `sourceState` is correctly `accessRequired`, but the name implies partial coverage exists.

### Replacement

```tsx
// OLD (lines 66–77):
{
  id: 'licensure',
  proofLabel: 'Licensure',
  name: 'CA State Board / FSMB',
  sublabel: 'CA physician lane only',
  tooltip:
    'State medical board data confirms licensure status and any disciplinary actions. Coverage varies by state; VitalCV currently supports CA via FSMB and is expanding.',
  sourceState: 'accessRequired',
  evidenceKind: 'generic',
  satisfied: false,
  detailLabel: 'Institutional access',
},

// NEW:
{
  id: 'licensure',
  proofLabel: 'Licensure',
  name: 'State Boards',
  sublabel: 'Institutional access required',
  tooltip:
    'State medical board data confirms licensure status and any disciplinary actions. Institutional access agreements (e.g., FSMB, Nursys) are required before this lane goes live. Not yet connected.',
  sourceState: 'accessRequired',
  evidenceKind: 'generic',
  satisfied: false,
  detailLabel: 'Not yet connected',
},
```

**Rationale:** Don't name a specific state or data partner when none are live. The `sourceState: 'accessRequired'` is correct — the label should match.

---

## 4. `apps/marketing/components/verifier/EvidenceBundlePreview.tsx` — SAM.gov and ABIM listed as verified

**File:** `apps/marketing/components/verifier/EvidenceBundlePreview.tsx`  
**Lines:** 9–15  
**Issue:** The evidence bundle preview shows a credential row for SAM.gov ("Clear") and ABIM Board Cert ("Verified"). Neither SAM.gov nor ABIM is integrated. This is pure demo theater on a buyer-facing page.

### Replacement

```tsx
// OLD (lines 9–15):
const credentials = [
  { field: 'License', value: 'MD-123456', source: 'CA Medical Board', status: 'Verified' },
  { field: 'Board Cert', value: 'Internal Medicine', source: 'ABIM', status: 'Verified' },
  { field: 'NPI', value: '1234567890', source: 'NPPES', status: 'Active' },
  { field: 'OIG', value: 'No exclusions', source: 'OIG LEIE', status: 'Clear' },
  { field: 'SAM', value: 'No exclusions', source: 'SAM.gov', status: 'Clear' },
];

// NEW:
const credentials = [
  { field: 'NPI', value: '1234567890', source: 'NPPES', status: 'Active' },
  { field: 'OIG', value: 'No exclusions', source: 'OIG LEIE', status: 'Clear' },
  { field: 'PECOS', value: 'Enrolled', source: 'CMS PECOS (quarterly)', status: 'Enrolled' },
  { field: 'License', value: '—', source: 'State Board', status: 'Access required' },
];
```

Also update the description paragraph (lines 33–36):
```tsx
// OLD:
<p className="mt-4 max-w-xl text-base text-muted">
  A signed, timestamped record of every credential check — license,
  board certification, NPI status, OIG exclusion, SAM exclusion — with
  source attribution and cryptographic proof of integrity.
</p>

// NEW:
<p className="mt-4 max-w-xl text-base text-muted">
  A signed, timestamped record of every credential check — NPI identity,
  OIG exclusion status, Medicare enrollment — with source attribution
  and cryptographic proof of integrity. Additional sources appear as
  institutional access is established.
</p>
```

---

## 5. `apps/marketing/components/verifier/ProblemSection.tsx` — "DEA, OIG, SAM" listed as sources

**File:** `apps/marketing/components/verifier/ProblemSection.tsx`  
**Lines:** 11–12  
**Issue:** Copy says "Each credential — license, board cert, DEA, OIG, SAM — requires independent verification." DEA and SAM are not integrated.

### Replacement

```tsx
// OLD:
'Each credential — license, board cert, DEA, OIG, SAM — requires independent verification.',

// NEW:
'Each credential — NPI identity, state license, exclusion status, Medicare enrollment — requires independent verification from primary sources.',
```

---

## 6. `apps/marketing/components/marketing/GraphPreview.tsx` — DEA node in credential graph + "graph" language

**File:** `apps/marketing/components/marketing/GraphPreview.tsx`  
**Lines:** 8–23, 39–46  
**Issue:** The graph visualization shows a "DEA" node as part of the credential chain. DEA is not integrated. The section is titled "Credential Graph" which implies a graph database (copy prohibition). The description mentions "DEA registrations."

### Replacement

```tsx
// OLD (lines 8–23):
const nodes = [
  { id: 'npi', label: 'NPI', x: 200, y: 60 },
  { id: 'license', label: 'Medical License', x: 80, y: 180 },
  { id: 'board', label: 'Board Cert', x: 200, y: 220 },
  { id: 'dea', label: 'DEA', x: 320, y: 180 },
  { id: 'vc', label: 'Verifiable Credential', x: 200, y: 340 },
];

const edges: [string, string][] = [
  ['npi', 'license'],
  ['npi', 'board'],
  ['npi', 'dea'],
  ['license', 'vc'],
  ['board', 'vc'],
  ['dea', 'vc'],
];

// NEW:
const nodes = [
  { id: 'npi', label: 'NPI', x: 200, y: 60 },
  { id: 'oig', label: 'OIG/LEIE', x: 100, y: 180 },
  { id: 'pecos', label: 'PECOS', x: 300, y: 180 },
  { id: 'vc', label: 'Readiness Snapshot', x: 200, y: 310 },
];

const edges: [string, string][] = [
  ['npi', 'oig'],
  ['npi', 'pecos'],
  ['oig', 'vc'],
  ['pecos', 'vc'],
];
```

And the copy (lines 36–46):
```tsx
// OLD:
<h2 className="text-sm font-medium uppercase tracking-widest text-muted">
  Credential Graph
</h2>
<p className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
  One identity. Every credential. Linked and verifiable.
</p>
<p className="mt-4 text-base leading-relaxed text-muted">
  VitalCV builds a connected graph of clinician credentials
  — NPI, state licenses, board certifications, DEA registrations —
  all anchored to a single portable identity.
</p>

// NEW:
<h2 className="text-sm font-medium uppercase tracking-widest text-muted">
  Source-Backed Chain
</h2>
<p className="mt-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
  One NPI. Source-backed checks. Portable readiness.
</p>
<p className="mt-4 text-base leading-relaxed text-muted">
  VitalCV chains source-backed credential checks to a single NPI
  — identity, exclusion status, Medicare enrollment — with additional
  sources activated as institutional access is established.
</p>
```

Also update the SVG aria-label:
```tsx
// OLD:
aria-label="Credential graph showing NPI connected to license, board certification, DEA, and verifiable credential"

// NEW:
aria-label="Source chain showing NPI connected to OIG exclusion check, PECOS enrollment, and readiness snapshot"
```

---

## 7. `apps/marketing/components/verifier/SecurityGuarantees.tsx` — "Zero-trust token binding"

**File:** `apps/marketing/components/verifier/SecurityGuarantees.tsx`  
**Line:** 23  
**Issue:** Label says "Zero-trust token binding". Copy prohibition: never say "zero-trust" — say "sender-constrained" or describe the actual mechanism.

### Replacement

```tsx
// OLD:
{
  label: 'Zero-trust token binding',
  detail:
    'Every access token is sender-constrained via DPoP proof-of-possession. PKCE S256 on all grants.',
},

// NEW:
{
  label: 'Sender-constrained token binding',
  detail:
    'Every access token is sender-constrained via DPoP proof-of-possession. PKCE S256 on all grants.',
},
```

---

## 8. `apps/web/components/passport/PassportWallet.tsx` — Hardcoded "Pending" badges for loading state

**File:** `apps/web/components/passport/PassportWallet.tsx`  
**Lines:** 460–519 (loading skeleton)  
**Issue:** The loading state renders hardcoded `TrustStatusBadge status="pending" label="Pending"` for NPPES, OIG/LEIE, CMS PECOS, and "Configured state board lane". These are NOT fake spinners that never resolve — they show while the passport is loading, which is correct. However, the "Configured state board lane" row should say "Access Required" not "Pending" since there is no state board adapter running.

### Replacement (line 501–503 only)

```tsx
// OLD:
<div className="flex items-center justify-between">
  <span className="text-xs text-muted-foreground">Configured state board lane</span>
  <TrustStatusBadge status="pending" label="Pending" size="sm" />
</div>

// NEW:
<div className="flex items-center justify-between">
  <span className="text-xs text-muted-foreground">State board licensure</span>
  <TrustStatusBadge status="access_required" label="Access required" size="sm" />
</div>
```

**Note:** The NPPES, OIG/LEIE, and PECOS "Pending" badges in the loading state are correct — they genuinely resolve when data arrives. No change needed for those three.

---

## 9. `apps/web/components/developers/ApiSandbox.tsx` — DEA in API sandbox

**File:** `apps/web/components/developers/ApiSandbox.tsx`  
**Line:** 34  
**Issue:** Developer sandbox shows DEA Registration as an available API field.

### Replacement

```tsx
// OLD:
{ id: 'dea',      label: 'DEA Registration',  field: 'dea_reg'       },

// NEW — remove this line entirely, or replace with:
{ id: 'pecos',    label: 'PECOS Enrollment',   field: 'pecos_status'  },
```

---

## 10. `apps/web/components/graph/TrustGraphPrimary.tsx` — DEA node in trust visualization

**File:** `apps/web/components/graph/TrustGraphPrimary.tsx`  
**Lines:** 201, 204  
**Issue:** The trust graph visualization includes DEA as an issuer node and "DEA Registration" as a credential node. DEA is not integrated.

### Replacement

```tsx
// OLD:
{ id: 'i3', label: 'DEA', type: 'issuer' },
...
{ id: 'cr3', label: 'DEA Registration', type: 'credential', meta: { exp: '2026-06-30', status: 'ACTIVE' } },

// NEW:
{ id: 'i3', label: 'CMS PECOS', type: 'issuer' },
...
{ id: 'cr3', label: 'Medicare Enrollment', type: 'credential', meta: { exp: '2026-06-30', status: 'ENROLLED' } },
```

---

## 11. `apps/web/stories/wireframes/VerifierReview.stories.tsx` — NPDB and DEA in storybook

**File:** `apps/web/stories/wireframes/VerifierReview.stories.tsx`  
**Lines:** 83, 136  
**Issue:** Storybook wireframe shows "NPDB Check" and "DEA Registration" rows. NPDB is explicitly NOT integrated (copy prohibition). DEA is not integrated.

### Replacement

```tsx
// Line 83 — replace "NPDB Check" with "OIG / LEIE Exclusion Check"
// Line 136 — replace "DEA Registration" with "CMS PECOS Enrollment"
```

---

## 12. `apps/web/stories/wireframes/OnboardingFlow.stories.tsx` — DEA in subhead

**File:** `apps/web/stories/wireframes/OnboardingFlow.stories.tsx`  
**Line:** 187  
**Issue:** Subhead says "VitalCV is securely fetching licenses, board certifications, and DEA registrations from primary sources."

### Replacement

```tsx
// OLD:
subhead="VitalCV is securely fetching licenses, board certifications, and DEA registrations from primary sources."

// NEW:
subhead="VitalCV is resolving your NPI identity, exclusion status, and Medicare enrollment from federal sources."
```

---

## Files NOT requiring changes (verified clean)

| File | Status | Notes |
|------|--------|-------|
| `apps/web/app/page.tsx` | **Clean** | Metadata correctly references "NPPES, OIG/LEIE, and PECOS" only |
| `apps/web/app/explore/page.tsx` | **Clean** | Generic copy, no source claims |
| `apps/web/app/employers/page.tsx` | **Clean** | Uses "source-backed" language, no fake sources listed |
| `apps/web/components/marketing/HomeSections.tsx` | **Clean** | Steps accurately describe NPPES → OIG → portability. No prohibited language found. |
| `apps/web/components/home/PublicTruthSections.tsx` | **Clean** | TrustStrip renders from `homepage-public-truth.ts` config (fix in item 3 above). Footer copy is honest. |
| `apps/web/components/hero/HeroWithAuthPrompt.tsx` | **Clean** | Wrapper only, delegates to LiveTrustConsole |
| `apps/web/components/review/ReviewClient.tsx` | **Clean** | Provenance contract is solid — every row carries source + timestamp + confidence label. Safety row references OIG LEIE. Eligibility row references CMS PECOS with quarterly lag disclaimers. Authority rows carry `observedAt`/`verifiedAt` timestamps. No provenance gaps found. |
| `apps/web/components/mobile/ClinicianHomeSurface.tsx` | **Clean** | No source-specific claims |
| `apps/web/components/mobile/ClinicianReadinessSurface.tsx` | **Clean** | Readiness is driven by live data, no fake spinners |

---

## Employer Review Provenance Audit (Step 4)

The `ReviewClient.tsx` decision surface was audited for provenance gaps. Findings:

1. **Identity row:** Derives status from `resolvePublicWedgeSurfaceStateFromTruth(truth.identity)`. Note includes `formatAsOfDate()` timestamp. **Provenance present.**

2. **Safety row (`buildSafetyRow`):** Includes `standing.exclusionCheckedAt` timestamp, `exclusionConfidenceLabel`, source explicitly identified as "OIG LEIE". **Provenance present.**

3. **Authority row (`buildAuthorityRow`):** Includes `credential.observedAt ?? credential.verifiedAt` timestamp, `dataFreshnessLabel`, `claimConfidenceLabel`. Method label resolved via `resolveAuthorityMethodLabel`. **Provenance present.**

4. **Eligibility row (`buildEligibilityRow`):** Includes `enrollmentObservedAt`, `enrollmentDataVersion` (quarter), `enrollmentFreshnessLabel`, `enrollmentConfidenceLabel`, explicit source label `CMS PECOS`. Includes disclaimer about quarterly publication lag. **Provenance present.**

5. **Decision posture card:** Shows `freshness.label` and `nextAction`. All action buttons (`Accept as head start`, `Request refresh`, `Route to review`) trigger persisted actions with audit events. **Provenance present.**

**Verdict:** The employer review surface passes the provenance receipt requirement. Every rendered data point carries source + timestamp + confidence. No changes required.

---

## Execution Notes

- All changes above are **copy/config only** — no Prisma schema changes, no route changes, no trust logic changes.
- Test files (`__tests__/`) that reference DEA are test fixtures, not user-facing. They should be updated in a follow-up wave to avoid confusion, but they are **not P0 blockers**.
- The `apps/web/components/issuer/IssuerPortal.tsx` references `DEA_REGISTRATION` as a credential type. This is internal issuer tooling, not buyer-facing. Flag for follow-up but not part of this purge.
- The `apps/web/components/clinician/WalletDashboard.tsx` has mock DEA credentials. This is archive/demo code. Not buyer-facing. Flag for follow-up.

---

*Generated 2026-04-09 by Claude Cowork acting as VitalCV Truth Purge Operator.*
