# Screen Composition Spec — per-route layout

Per-route composition recipes. Captures the visual + content order for each major surface so subsequent integration waves (H / I / J / K) can pick up the same shape.

## `/` Homepage (Wave I target)

```
─── Top nav ──────────────────────────
                                  Sign in
─── Hero (centered) ──────────────────
        Look up an NPI. See what is source-backed,
        what is gated, and what still needs institution review.

           [ NPI input · 10 digits  ]  [ Look up → ]

─── Role doors (4-tile grid) ─────────
  Verifier        Clinician         Employer        Issuer
  Look up an NPI  Claim my record   Review a        Connect a
                                    passport         source

─── Proof strip (3-column) ───────────
  Source           State              Review boundary
  NPPES, …         source-backed      institution review

─── Footer (trust row) ───────────────
  Status ·  Source attribution ·  Trust   ·   Sign in
```

Visual: one accent color on the primary lookup CTA. Role doors use neutral chrome with a single accent border on hover. Proof strip uses `TruthStateChip` for the State column.

Constraints (from Wave I spec):

- No "Get verified". No bare "Verified". No "universal acceptance".
- NPI lookup is primary; sign-in is secondary.
- Headline is the trust-bounded copy above.

Components:

- `Button variant="primary"` for "Look up →".
- `Card` (with a hover accent) for each role door.
- `TruthStateChip` in proof strip's State column.

## `/passport`, `/passport/[id]` (Wave H target)

```
─── Top nav ───────────────────────────
─── Passport header ──────────────────
  Clinician name / NPI / org context.
  If degraded: "Source temporarily unavailable. This is a
  system condition, not a finding about the clinician."

─── 5-row truth legend (TruthStateLegend default) ──
  [chip] Source-backed       … (meaning)
  [chip] Snapshot only       …
  [chip] Temporarily unavailable …
  [chip] Institution review  …
  [chip] Access required     …

─── Source rows ──────────────────────
  NPPES         [chip]  reason copy.  timestamp  next action
  OIG/LEIE      [chip]  reason copy.  timestamp  next action
  CMS PECOS     [chip]  reason copy.  timestamp  next action
  State board   [chip]  reason copy.  timestamp  next action

─── Institution review panel ─────────
  "This view is a reviewer-ready head start, not a final
   credentialing decision."

─── Footer ───────────────────────────
```

Constraints (from Wave H spec):

- NPPES unavailable remains unavailable when no payload exists.
- OIG/PECOS/state-board remain `connector-not-live` unless backend says otherwise.
- No skeleton loaders on terminal degraded state — render the calm degraded surface directly.
- No bare "Verified" anywhere. The Source-backed chip is the only positive surface for NPPES intact-payload state.

Components:

- `TruthStateLegend rows="passport"` at top.
- Each source row uses `TruthStateChip` (state + sourceLabel for aria).
- `Card` for the institution review panel.

## `/sign-in`, `/sign-up` (Wave J target)

```
─── Centered auth card ───────────────
  Sign in  /  Create operator account

  ─ disclosure text ─
  "Sign in unlocks live event streams and operator tools.
   Public passport pages remain readable without an account."

  ─ primary action (Clerk) ─
  [ Continue with email / SSO ]

  ─ secondary trust links ─
  Status ·  Source attribution ·  Trust
```

Constraints (from Wave J spec):

- No Clerk config changes — pure UI.
- No "verify your email to get verified" — banned.
- One primary action. Marketing noise off.
- Distinguish AUTH-required state from SSE-unavailable in error chrome (use the `auth-required` chip rather than a generic error).

Components:

- `Card` for the calm visual card.
- `TruthStateChip state="auth-required"` for the contextual chip in any "you must sign in to see this" inline message.

## `/status` (Wave K target — Connector Matrix)

```
─── Top nav ──────────────────────────
─── Disclaimer banner ────────────────
  "We publish the source of every field. We do not claim
   HIPAA, SOC 2, or NCQA certification."

─── 8-row Truth State Legend (full) ──
─── Connector Matrix (table) ─────────
  Connector | State     | Last checked / unavailable / not connected
            |           | Access requirement | User interpretation
  ----------+-----------+--------------------+-------------------------
  NPPES     | [chip]    | 2026-05-27 03:18Z  | identity registry public
  OIG/LEIE  | [chip]    | n/a                | not connected; do not
                                              treat as exclusion
                                              clearance.
  …
```

Constraints (from Wave K spec):

- No fake source connectivity.
- No unsupported compliance claims.
- Document-register visual style, not marketing hero chrome.

Components:

- `TruthStateLegend rows="all"` (full 8-row).
- `Table` from design-system for the matrix.
- `TruthStateChip` per row.

## `/trust/attribution` (Wave K target — Trust Attribution)

```
─── Top nav ─────────────────────────
─── Disclaimer (same as /status) ────
─── Field-by-field register ─────────
  Field | Source | Retrieval time | State chip | Review boundary
  ------+--------+----------------+------------+-----------------
  Name  | NPPES  | 2026-05-27 …   | [chip]     | institution review
  NPI   | input  | now            | [chip]     | n/a
  …
```

Constraints:

- Per-field; no aggregate claims at the top.
- Every "Review boundary" cell either says "institution review" or "n/a" — never "verified".

Components:

- `Table` for the register.
- `TruthStateChip` per State cell.

## Out of scope for this doc

- Visual north star (palette / typography / motion) — see `vitalcv-visual-system.md`.
- Per-component API — see `component-library-spec.md`.
- State treatments — see `state-model-as-design.md`.
- Sequence — see `ui-implementation-roadmap.md`.
