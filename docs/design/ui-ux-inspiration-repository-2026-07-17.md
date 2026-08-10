# VitalCV UI/UX Inspiration Repository — 100-Source Research Synthesis

**Date:** 2026-07-17
**Method:** 7 parallel research agents over the canonical 100-link research list ("VitalCV UI/UX and Platform Architecture Repository"), batched by section (holder UX ×2, competitors, immutable-architecture, cryptographic wallet UX, verifier cockpit, market/infra). 97/100 URLs were read directly or recovered via search fallback; the 3 unreadable ones are marked in the agent transcripts and nothing was invented from URL slugs. Every item below carries its source(s) and a surface tag.
**Status vocabulary used throughout:** checked / gated / stale / unknown; revoked fails closed. No proposal below may ship copy containing the CLAUDE.md banned strings, and no status label may be the bare word "Verified" (quoted here only as a competitor anti-pattern).
**Before building:** re-audit `origin/main` (this tree may be stale — see the audit-staleness-trap memory). Map each item against BOTH `apps/web/design-system/` primitives (FreshnessIndicator, EvidenceTable, LaneStateBadge, IdentityField, GraphLegend…) and the newer Calm Wave `.mz` layer (`apps/web/styles/matcha-zen.css`) before writing a new component.

---

## Part 0 — The reconciliation thesis: "Palantir-tier" without dark-ops cosplay

The research manifest asks for authoritative, evidence-dense, "Liquid Glass" infrastructure. The 100 sources converge on a clear answer for how VitalCV gets there **without abandoning Calm Wave**:

1. **Authority comes from provenance density, not theme drama.** The "Palantir-tier" look, examined closely (Vanta's trust center, Elastic's benchmark methodology blocks, transparency.dev's log explorers), is: mono ledger lines, dense evidence tables, named sources, dated everything, published methodology. Paper + ink + Fraunces can carry all of that. No dark-ops reskin needed.
2. **The Living Trust rule already is the Liquid Glass reconciliation.** Glass stays on chrome (nav, rails, floating panels); evidence stays SOLID and opaque. Every source that touched trust UX agrees: translucency on evidence reads as evasion.
3. **Two tempos, one system** (sprypt adoption-first finding): calm consumer-grade wallet for holders; dense operational surfaces for employers/auditors. Same tokens, same chips, different information density.
4. **Honesty is the visible differentiator, not a constraint.** The single most repeated competitive finding: incumbents assert ("2M+ Verified Providers", "97% reduction", "cannot be tampered with or hacked"); nobody *shows*. Rendering the truth contract as UI — per-field provenance, watchable verification, named limits — is the design strategy, not the compliance tax.

---

## Part 1 — Trust primitives (build once, reuse everywhere)

- **T1. The provenance chip.** Atomic unit of every evidence surface: status dot + status word + mono provenance line — `● checked · NPPES · 2026-07-14`. Never icon-only, never color-only, never a bare status word without source + timestamp. *(capminds, hubifi, humanmedicalbilling — NCQA now treats timestamped documentation as table stakes)* → extend `LaneStateBadge`/`FreshnessIndicator`. [design-language]
- **T2. Distinct fail-closed register.** Each status gets its own hue, not intensity steps of one warning color. Red belongs to revoked **exclusively**; revoked/broken-chain render as loud terminal full-stop states (content blocked, custody history still visible), never as a warning badge next to green rows. *(orangesoft severity tiers, labmanager, everycred)* [design-language] [readiness]
- **T3. As-of discipline.** No trust statement is undated. Every chip, claim, metric, and marketing stat carries an as-of timestamp or citation line. Applies to our own marketing pages citing benchmarks ("last reviewed <date>"). *(threatmodeler STRIDE static-analysis critique; zfort staleness-rot object lesson)* [design-language]
- **T4. The attestation block.** One reusable component for any human attestation (translation, reference, policy review): statement text, attester identity + qualification, timestamp, signature state — each element its own checked line. *(asaptranslate anatomy, ecfmg requirements)* [audit-provenance]
- **T5. Receipt IDs.** Every evidence artifact and consent event gets a short resolvable mono ID (`VCV-7F3K-2201`) that anyone can enter at /verify — the paper-world verification pattern credentialing staff already trust. *(asaptranslate tracking numbers)* [public-verify] [audit-provenance]
- **T6. Self-attested quarantine.** Self-attested and soft attributes always render in a visually distinct band — dashed border, explicit `self-attested` chip, own surface treatment — and can never visually blend into source-checked evidence. The IAL ladder (self-asserted → evidence-backed → supervised) is the ready-made explanation for *why* the two render differently. *(certifyos, intelycare, proof.com)* [design-language] [readiness]
- **T7. STRIDE-complete chip legend.** The trust-indicator set derives from the six STRIDE properties: identity-tier chip (anti-spoofing), document integrity seal (anti-tampering), inline audit receipt (anti-repudiation), visibility-scope chip (anti-disclosure), monitor heartbeat (availability), role badge (anti-elevation). Publish the legend so the set is provably complete. *(threatmodeler)* [design-language] [employer-review]
- **T8. The methodology block.** Elastic's benchmark-credibility format — claim + dataset + n + date range + method + known recall/limits, in mono fine print — under every published VitalCV metric (Time-to-Start medians especially). This block IS the Palantir-tier look. *(elastic, medtrainer's 30–150-day industry turnaround spread proves "measurable" is itself the differentiator)* [design-language] [homepage] [ops-dashboard]

## Part 2 — Holder wallet & ceremonies

- **W1. Actions-queue home + progress spine.** Wallet home leads with an actionable queue (license expiring, check going stale, pending employer access request — each row a direct action), with the Recognition → Acceptance → Start rail as a persistent progress spine, current stage lit. *(procreator task-oriented dashboards; symplr provider "Personal Dashboard")* [holder-wallet]
- **W2. The "here's what the sources say about you" moment.** NPI intake stages pre-population as an explicit beat: source-backed fields arrive visually pre-settled with source labels, gaps highlighted, then review → confirm. Auto-filled ≠ checked — every pre-populated field carries its source so pre-population never masquerades as verification. *(AMA VeriCre flow; CAQH re-attestation treadmill inverted; cieden)* [holder-wallet] [readiness]
- **W3. "Why we ask" onboarding.** Every intake step carries a one-line rationale naming the source it feeds and flagging self-reported fields ("We ask for your NPI to pull your NPPES record — free federal source"). Onboarding as the user's first provenance lesson. *(eleken/b.well)* [holder-wallet]
- **W4. Credential claim ceremony (OID4VCI pre-authorized pattern).** When source checks complete, a claim card appears in the signed-in wallet: one-click "Add readiness passport to wallet," optional 6-digit tx-code sent to the confirmed work email (metadata-driven entry: N mono boxes, correct keyboard, channel hint), ending in an explicit receipt. Deliberate small friction = ceremony weight. *(mattr, authlete, corbado)* [holder-wallet] [motion]
- **W5. Pending ghost cards (deferred issuance).** Slow sources get a physical home: a ghosted placeholder card — "Issuance pending · waiting on state board response · gated" — that resolves in place when the check clears. Honest gated/stale states stop being abstract. *(authlete deferred endpoint)* [holder-wallet] [readiness]
- **W6. Consent & shares ledger + viewer activity.** A first-class wallet page: one row per disclosure event (recipient, exact fields shared, timestamp, expiry, Revoke control) plus an owner-visible activity feed — who opened your packet, which sections, when, modeled as request → authorization → delivery. Viewing the ledger is itself a logged event. *(OpenWallet safety checklist — effectively a ready-made requirements doc; vanta viewer insights; GRM real-time owner visibility; hubifi "audit trail for the audit trail")* [holder-wallet] [audit-provenance]
- **W7. The export-and-leave door.** A visible one-screen "export your evidence" affordance. Clinician ownership must be structurally true — the inverse of VisualCV's watermark-ransom and cancellation dark patterns. *(uibakery code-ownership trust axis; trustpilot/visualcv anti-pattern)* [holder-wallet]
- **W8. Key safety & honest auth tiering.** Security settings rank methods with assurance labels ("Passkey — strongest · Email code — basic"), deprecated factors carry an explicit downgrade note, and recovery setup is its own solemn ceremony with named attack-surface warnings. *(hypr NIST 800-63, iddataweb, OpenWallet)* [holder-wallet]

## Part 3 — Readiness & freshness

- **R1. Derivation-transparent snapshot.** The readiness surface states its own formula inline: "Readiness reflects 6 source checks — NPPES (checked 2026-07-14), OIG exclusions (checked 2026-07-12), DEA (gated)…". No opaque score exists anywhere in the product. *(orangesoft derivation-transparency)* [readiness]
- **R2. PSV chain stepper.** Per evidence row: `source contacted → response received → checked / gated / unknown`, each step timestamped, with **method** shown (registry API / file ingest / manual) alongside source. Deliberately no bare terminal state. *(biz4group status progressions; atlassystems 8-step PSV workflow + method-in-audit-trail requirement)* [readiness] [audit-provenance]
- **R3. Regulator-anchored freshness meters.** Evidence age plotted against the real NCQA 2025 windows (120-day accredited / 90-day CVO, monthly license tracking, 30-day sanction sweeps) — `stale` trips exactly where the industry deadline would. Our abstract statuses become the visible enforcement of a rule the whole industry just adopted. *(andros, providertrust, rldatix)* [readiness]
- **R4. Cadence rhythm rows.** Monitoring is a separate always-on lane from point-in-time checks, and each monitoring row shows its mechanical rhythm: `last swept 2026-07-01 · next due 2026-08-01`. *(providertrust continuous-monitoring lane; humanmedicalbilling scheduled sweeps)* [readiness] [audit-provenance]
- **R5. Expirables horizon + decay.** A 12-month horizon strip with tick marks per upcoming expiry; per-credential lifespan bars with decay shading toward expiry; 90/60/30-day escalation ladder (quiet note → amber → prominent). Staleness becomes a gradient you can see across the whole wallet — and it is also the product's honest retention engine. *(atlassystems, kimedics, biz4group; raaft churn economics)* [holder-wallet] [readiness]
- **R6. Triage-first + gated-source banners.** Blockers band above the inventory ("2 gated checks block employer acceptance"); unreachable/gated sources surface as an honest top banner (Nursys SOURCE_ACCESS_REQUIRED style), never quietly parked as `unknown` rows. *(acropolium triage dashboards; orangesoft device-status pattern)* [readiness]
- **R7. Readiness against a profile.** Employer orgs define requirement profiles (role × state); the snapshot is evaluated *relative to a profile* — "ready against Med-Surg RN, Texas" — with the same evidence showing different gaps per target. Kills the fantasy of one absolute readiness score. *(harborclinical per-role/per-region frameworks; kimedics per-context matrices)* [readiness] [employer-review]
- **R8. Staged attainment states.** Partial progress is named, not hidden: "written passed · oral pending" (NBCMI's Hub-CMI → CMI ladder) maps to our identity tiers and multi-step checks. *(certifiedmedicalinterpreters)* [readiness]

## Part 4 — Proof packet & the share ceremony

- **P1. SD-JWT disclosure composer.** The packet renders as its actual cryptographic shape: an issuer-signed spine (solid ink bar) with per-field disclosure chips hanging off it. Toggling a field off collapses it to a **sealed digest stub** — "verifier sees a salted hash, not your data." Selective disclosure stops being a settings panel and becomes the product's signature interaction. *(sdjwt.js.org / RFC 9901 — the wire format is literally the layout)* [proof-packet]
- **P2. Share-time seal.** Every share is stamped with a key-binding footer: "Signed with Dr. Chen's key at 14:32 UTC · bound to this exact selection," plus nonce-freshness line ("proof generated moments ago · single-use"). Each share is a distinct timestamped ceremony, not a static link. *(sdjwt KB-JWT, authlete c_nonce)* [proof-packet] [audit-provenance]
- **P3. Counterparty-first ceremony order.** WHO is asking renders before WHAT they ask: org identity card (name, requester role, request timestamp, authorization evidence, expandable detail levels) precedes the field list. Named recipient stays on the packet afterward. *(OpenWallet progressive counterparty identity; careexpand; AMA VeriCre named delivery)* [proof-packet] [employer-review]
- **P4. Audience presets + disclosure chip.** Composer scopes by recipient context (hospital privileging / payer enrollment / locums) instead of checkbox soup; the packet header always shows its cut: `Employer view · 14 of 22 fields disclosed · granted 2026-07-17`. *(procredex share curation; acropolium role-scoped views; vanta filtered trust views)* [proof-packet]
- **P5. Predicate disclosure.** Requirement-satisfied chips with values withheld until acceptance: "Active TX license — number withheld until you accept," "Board-certified ≥ 5 years — dates withheld." The employer sees the satisfied requirement before the raw value; full values unlock on Accept as Head Start. *(mattr OID4VP age-over-X pattern; procreator data masking)* [proof-packet] [employer-review]
- **P6. Oversharing alert.** When a request exceeds the typical credentialing field set: calm inline caution — "This request asks for 3 fields beyond the typical credentialing set" — with one-tap withhold. Data minimization as an active affordance. *(OpenWallet safety checklist)* [proof-packet]
- **P7. Anti-urgency consent.** The final share screen is deliberately slow: enumerate exactly which claims cross the boundary, to whom, with the revoke path visible. Consent is per-data-point, never one "Share profile?" modal. Deliberateness is the trust signal separating evidence infrastructure from engagement software. *(hims frictionless-checkout inverted; mattr per-data-point consent; orangesoft dark-UX warnings)* [proof-packet] [motion]
- **P8. Sealed snapshots + living links.** Point-in-time exports are visually "sealed" ("Sealed 2026-07-17 14:02 UTC," frozen treatment, digest shown) and distinct from the live wallet; printed/PDF packets carry a QR resolving to the live verify surface, binding the static artifact to the living chain. Default share = the living link. *(geeksforgeeks immutable snapshots; labmanager QR-to-digital custody; realtimecv/visualcv dead-artifact anti-pattern inverted)* [proof-packet] [public-verify]
- **P9. Terminal receipts.** Every ceremony ends on an explicit success/failure receipt screen (linked consent record, or plain-language failure reason) — never a modal that just closes. *(OpenWallet explicit terminal states)* [proof-packet] [motion]

## Part 5 — Employer review cockpit

- **E1. Exception-first default.** The cockpit shows only what needs a human; the healthy majority collapses into one calm band — "31 candidates progressing — no action needed." Density where it matters, silence where it doesn't. *(censinet)* [employer-review]
- **E2. Reserved fail-closed band.** Flags triage on a severity × scope model with a visually reserved top band that **only** fail-closed events (exclusion hit, revoked license) may occupy — nothing else may ever use that color or position. *(Joint Commission SAFER matrix)* [employer-review] [design-language]
- **E3. Enumerated blocking conditions.** A static "conditions that stop everything" panel — the finite published list of fail-closed triggers — so reviewers know the rules before they hit one. *(Joint Commission preliminary-denial list)* [employer-review]
- **E4. Disposition-required flags.** No flag can be dismissed without a recorded disposition verb + actor + timestamp; undispositioned flags render as visible open debt. Mirrors Accept / Request Refresh / Route to Review exactly. *(OWASP accept/eliminate/mitigate/transfer)* [employer-review] [audit-provenance]
- **E5. Re-share diff — "what changed since you accepted."** When a packet is re-shared to an employer who previously accepted, lead with the delta: "2 checks refreshed, 1 new license, nothing revoked since your acceptance on <date>." The single strongest re-review killer found; makes Accept as Head Start compound over time. *(symplr roster added/deleted/changed tracking)* [employer-review] [proof-packet]
- **E6. Watch this passport.** Post-acceptance subscription: employer gets notified on stale/revoked/refreshed transitions of an accepted packet, plus a watchlist of accepted providers approaching stale. One-time acceptance becomes a standing trust relationship. *(procredex subscribe; harborclinical expiration pain)* [employer-review]
- **E7. Consequence-aware states + countdown.** Stale/revoked states name what they block — "packet acceptance paused for this employer until license refresh" — with the NCQA 30-day remediation countdown chip live on both sides. Fails-closed becomes legible instead of a mute red dot. *(kimedics scheduling-block pattern; rldatix)* [employer-review] [readiness]
- **E8. Acceptance as signature ceremony; refusal requires words.** Accept as Head Start commits in one click but *feels* signed: explicit signer identity, timestamp, meaning-of-signature text, producing a signed acceptance event. Request Refresh and Route to Review require a structured typed rationale that lands in the audit trail. *(labvantage 21 CFR Part 11 signature pairing; NCQA structured decision verbs with forced rationale)* [employer-review] [audit-provenance]
- **E9. Route-to-Review as a real multi-party surface.** Named-reviewer chips, per-reviewer decision state, visible quorum; the five ordered policy gates render as a literal numbered gate checklist with pass/block state per gate. *(symplr committee voting; bytebase propose→review→approve→apply; biz4group approval chains)* [employer-review]
- **E10. Requirements coverage matrix + self-select mirror.** Grid: rows = the profile's required checks, columns = check families, every cell an explicit state (checked/gated/stale/unknown/n-a) — an empty cell is itself an alarm. Both sides see the same requirement checklist rendered against the candidate's actual evidence states before either commits. *(cybersierra STRIDE coverage sweep; intelycare self-selection)* [employer-review] [readiness]
- **E11. Tenant-context discipline.** Deliberate org-context entry, persistent org-scope chip in the chrome, org-scoped audit streams by default, and policy-version stamps on decisions ("accepted under review policy v4") so old acceptances stay interpretable. *(workos two-phase auth; confluent per-tenant streams; bytebase metadata registry)* [employer-review] [audit-provenance]
- **E12. The KPI header, opinionated.** Top of cockpit: status-distribution bar + Time-to-Start trend, side by side. Role lenses (credentialing lead / finance / exec) — the split, not Penrod's 35-KPI sprawl. Optional delay-cost tile: employer's own revenue-per-provider input × measured days-saved from real acceptance timestamps, assumption labeled. Funnel view attributes stalls honestly (holder never shared / employer never opened / refresh unreturned). *(rldatix paired metrics; penrod persona split; phoenix $350–900k revenue-per-provider math; webmdignite funnel-by-service-line)* [employer-review] [ops-dashboard]
- **E13. Closed-loop refresh chips.** Request Refresh tracks its loop like a diagnostic result: sent → received → acknowledged → acted, with the stuck stage visible per artifact. *(Joint Commission closed-loop rule)* [employer-review] [motion]

## Part 6 — Public verify (/verify/[npi])

- **V1. Beat TopNPI on honesty.** Their model: one global "Last synced" for the whole site and a bare-"Verified"-providers headline slapped on self-reported NPPES data (their brand is literally our banned word). Ours: per-field provenance (source + fetch timestamp per claim), NPPES-derived fields explicitly labeled "self-reported to NPPES," `checked` reserved for actual source checks. Honesty rendered as design is the differentiation. *(topnpi)* [public-verify]
- **V2. 3-stat scanable header.** Keep their card shape, replace the metrics: sources checked · last check timestamp · readiness state. Identity block (avatar, name, NPI, specialty, state chips) above the fold. *(topnpi header pattern; easternstandard provider-profile anatomy)* [public-verify]
- **V3. One door, many artifacts.** /verify accepts anything — NPI, packet URL, QR scan, receipt ID — and routes internally. *(GS1 universal-resolver pattern; T5 receipt IDs)* [public-verify]
- **V4. Two-half verdict.** Results split into two labeled panels: **Integrity** (signature line items: duplicate-digest rejection, unreferenced-disclosure detection, claim-collision checks — each named, each with pass state) and **Issuer legitimacy** (registry lookup rendered as a watchable step: "Checking issuer registry… found · registry entry updated <date>"). A signature-valid credential from an unrecognized issuer renders as a distinct mixed state, never collapsed into one green banner. *(credentialengine two-half framing; sdjwt named integrity checks)* [public-verify] [audit-provenance]
- **V5. Revocation as a visible step.** "Revocation status: none found · checked against status list · 14:32 UTC" on every view; revoked renders a full-stop fail-closed page, not a warning badge. *(everycred; T2)* [public-verify]
- **V6. Domain-anchored issuer identity.** Top layer says "Issued by **vitalcv.com**"; the DID/key material lives one disclosure level down. Adopt the did:webs dual-anchor typography: human-readable prefix in Geist, cryptographic tail in mono with middle truncation + tap-to-expand. *(lymah DID comparison; trustoverip did:webs)* [public-verify] [design-language]
- **V7. The strongest honest claims, stated plainly.** "Even if our servers were compromised, a forged record would fail signature checks" (did:webs property). "No one — not even administrators — can alter an entry without leaving an indelible trail" (naming the operator's own constraints beats any badge). Plus an honest trust FAQ: "What does checked mean?", "What happens when a source is unreachable?", "What does revoked do?" *(trustoverip, labmanager, ttms)* [public-verify] [homepage]

## Part 7 — Audit & provenance viewers

- **A1. Two-layer ledger.** Human-legible narrative layer (who, action, commit time) rendered over the raw append-only chain layer (transaction id, sequence number, operation type, hashes), toggleable — the AuditProofViewer evolution path. *(dzone SQL Server Ledger view join)* [audit-provenance]
- **A2. Verification as a stepwise mono transcript.** Proof checking renders line-by-line: per-event hashes → "Chain valid" → "Merkle root: <hash>" → "inclusion verified" — each line resolving in sequence with a restrained reveal. Failures locate the exact break: "Event 2 hash mismatch: content was modified" — never a generic "verification failed." *(veritaschain ed25519/Merkle build log — the console output is the UI spec)* [audit-provenance] [motion]
- **A3. User-triggered "Verify this ledger."** A button that visibly recomputes digests and reports pass/fail with the discrepancy located. Verification as an interactive moment, not a static badge. *(dzone sp_verify pattern)* [public-verify] [audit-provenance]
- **A4. Signed checkpoint + pinnable root + consistency indicator.** One root-hash chip anchors every packet; a signed-checkpoint badge expands to signer identity, key, signature time; employers get a "pin this checkpoint" affordance (copy/download the root they accepted against); re-opening an old packet shows "log then vs log now — consistent." *(transparency.dev verifiable data structures)* [proof-packet] [employer-review] [audit-provenance]
- **A5. Pending → anchored state machine.** Anchoring is never instant (measured finality: 2–60s depending on chain) — render two labeled moments: `anchor submitted 14:02:11 → consensus 14:02:14`, server received-at vs chain consensus-at, with "anchored" never rendered optimistically. Batch anchoring disclosed honestly ("anchored in batch B at consensus T"). GDPR-safe copy ready-made: "only cryptographic fingerprints are anchored — documents and personal data never touch a chain." *(edupij measured chain benchmarks; hedera consensus timestamps)* [audit-provenance] [proof-packet]
- **A6. Custody timeline with visible gaps.** Vertical handoff chain (intake → checked → sealed → shared → reviewed → accepted), each node showing verified actor + timestamp; atomic row = who | when | **why** (purpose of transfer). Any unverifiable interval draws as a highlighted gap segment and the artifact auto-degrades to stale/unknown until revalidated; retired artifacts get visible tombstones, never silent deletion. *(CISA chain-of-custody; labmanager ALCOA+; GRM lifecycle receipts)* [audit-provenance] [proof-packet]
- **A7. Monitor heartbeat.** "No alerts" is only meaningful next to proof the monitor is alive: "exclusion monitor — last sweep 03:00 today" beside every quiet rail; a stalled monitor is itself a warning state. *(CISA undetected-break warning; censinet named-source sweeps)* [employer-review] [design-language]
- **A8. Event-row anatomy.** Four-column grammar (who / what / when / where) for scanability; three-part expandable rows (human summary / payload / security block with prev_hash, signature, signer); outcome as a strict enum badge; filterable source-type tag pills; hot vs "archived — still verifiable" tiers; older ranges collapse into summarized, still-verifiable groups. *(hubifi; veritaschain; confluent audit-event schema; geeksforgeeks history growth)* [audit-provenance]
- **A9. Layered protection panel + graph-drawn proofs.** Per credential: three expandable strata — Content (what's attested) / Signature (ES256, who signed) / Anchor (Merkle root, where anchored). Inclusion proofs *draw the path* leaf → intermediates → root on the existing canvas-graph language as verification runs. *(GS1 layer split; transparency.dev inclusion paths)* [audit-provenance] [motion]
- **A10. Replay honesty.** Cached/replayed results always carry their original check timestamp and a replay label — never presented as fresh; refreshes state exactly which readiness items were re-evaluated vs replayed. *(nx replay/affected semantics)* [readiness] [audit-provenance]

## Part 8 — Motion system

- **M1. The restraint doctrine.** Animation is reserved for **evidence state changes** (a check completing, an anchor landing, a status transition); no decorative loops on evidence surfaces; motion never blocks first paint; evidence tables skeleton-load per row rather than gating on the slowest source. *(careexpand, procreator, forefront performance-as-trust)* [motion] [design-language]
- **M2. Live source-check narration — the "watched it work" moment.** The in-hero and readiness-surface run narrates per source, one row resolving at a time: "Querying NPPES… → checked 14:32:07 UTC." Honest latency beats a fake spinner; each loop iteration is a visible step ("queried NPPES → parsing → cross-checking state board"). This is the Living Trust Sprint-2 hero moment, fully validated. *(procreator microinteraction feedback; exabeam ReAct loop-progress)* [motion] [readiness] [homepage]
- **M3. Transcript reveal.** A2's verification transcript animates as a line-by-line mono reveal — Calm Wave's typewriter language applied to proof, not marketing. *(veritaschain)* [motion] [audit-provenance]
- **M4. The 1 → 13 orgs sequence.** Career-graph animation: one clinician node, ~13 org edges (the average physician's credentialing relationships), a single packet flowing outward and landing as an acceptance at each. The entire reuse thesis in one motion sequence for the homepage hero. *(chief-healthcare-executive-adjacent stat)* [homepage] [motion]
- **M5. Card flip to provenance.** Hovering a credential card cross-fades its summary face into its provenance face (source, mono timestamp, status chip) — "evidence has a back side" as a felt interaction. *(hims hover-morph)* [holder-wallet] [motion]
- **M6. Ceremony micro-states.** Provenance-first loading states instead of generic spinners: "Resolving issuer identity… issuer.vitalcv.com · metadata retrieved"; tx-code entry boxes; claim-ceremony stepper (Offer received → Identity confirmed → Issued → In your wallet), each step timestamped. *(corbado, authlete)* [motion] [holder-wallet]
- **M7. Anti-urgency.** No fake countdowns, no streak-loss pressure, no red-alert abuse, no "no time to think" flows. The acceptable ceiling for nudges: predictive gentle notices with provenance ("license expires in 60 days — source: NPPES"). Real countdowns (NCQA 30-day remediation) are fine — they're evidence. *(orangesoft dark-UX list; hims inversion)* [motion] [anti-pattern]

## Part 9 — AI transparency (MATCHA)

- **AI1. The permissible/impermissible table.** An in-product two-column artifact: what MATCHA may do unattended vs what always requires a human (accepting candidates; anything touching the audit ledger). Directly anticipates NCQA's 2027 AI standards (their Element A requires exactly this definition). *(NCQA AI-Standards memo)* [employer-review] [public-verify]
- **AI2. Reason codes, never scores.** The why-this-match panel is a stack of labeled reason-code rows, each with its provenance chip (checked / self-attested / stated preference). No single compatibility percentage exists anywhere. *(x0pa — whose "up to 95% fit accuracy" is the anti-pattern)* [employer-review]
- **AI3. Negative disclosure.** A visible "not used in matching" list (demographics, photos, salary history) — naming absent inputs builds more trust than describing present ones. Plus the chip MATCHA has earned: "ranking is deterministic — no behavioral personalization." *(x0pa bias mitigation; staffingindustry personalization inverted)* [employer-review] [public-verify]
- **AI4. Agent scope cards.** Wherever an assistant appears: a small card stating what it can read, what it can draft, what it can never do ("cannot accept candidates; cannot write audit rows"). Least-privilege as visible UI. *(exabeam guardrails best-practice)* [employer-review] [design-language]
- **AI5. The designed approval moment.** AI proposals terminate in an approval screen showing the agent's plan, the evidence rows it used, and what will be written where — the commit button is the human's alone; every agent step logs as a typed row (observed / reasoned / acted) replayable in the audit viewer. *(exabeam HITL pattern; censinet exception-first ops)* [employer-review] [audit-provenance]
- **AI6. Governance spine + versioned re-badging.** Profile chip on every match ("MATCHA scoring profile v3 — credentials + stated preferences only") linked to a changelog; after an engine version bump, matches visibly re-badge ("re-evaluated under v4"); an inputs manifest (source + pull timestamp per input) per suggestion; "evidence submitted — not yet scored" as a first-class state; a dated "last fairness review" line. *(auditboard NIST AI RMF; NCQA no-scoring-option sequencing)* [employer-review] [audit-provenance]

## Part 10 — Search honesty

- **S1. Exact-field allowlist.** Identity fields (NPI, license number) are exact-match only — semantic ranking can never touch them. A fuzzy NPI hit is a truth-contract violation expressed in the search layer. *(zilliz hybrid-search convergence)* [search]
- **S2. Labeled result groups + visible expansion.** "Exact matches" / "Related" groupings with why-matched on each card; query expansion shown as removable chips ("RN" → +Registered Nurse, +BSN…); a criteria drawer where toggling live-updates the count, with the applied criteria set stamped on saved shortlists. *(capella engine-per-workload; staffingindustry inspectable ranking)* [search] [employer-review]
- **S3. Honest coverage toggle + p99 budget.** "Fast browse — top matches, not exhaustive" (approximate, ~0.96 recall disclosed) vs "complete sweep — exhaustive, slower" for audit-grade queries; latency budget defined at p99 with honest degradation (partial results + "still searching"), never an indefinite spinner. *(elastic 112ms filtered kNN; capella tail-latency findings)* [search] [audit-provenance]

## Part 11 — Ops / investor dashboard

- **O1. Re-acceptance rate** — the same passport accepted by a 2nd+ employer — as the first-class network-effect KPI (the NRR analog an acquirer would open first). *(phoenix)* [ops-dashboard]
- **O2. Cohort retention both sides** (monthly-active passports; verifier orgs with a 2nd acceptance), with the staleness → refresh loop instrumented as the designed retention mechanic. *(raaft churn brackets)* [ops-dashboard]
- **O3. Unit-economics pairing.** Every growth tile carries its economics companion; "variable cost per readiness snapshot" is a structural differentiator under the free-sources policy and belongs on pricing/ops surfaces. *(aventis efficiency-era; webmdignite contribution margin)* [ops-dashboard]
- **O4. Export-ready, dated KPI tiles.** Screenshot-stable, as-of-dated, source-lined — usable directly as investor-update artifacts (and a Reg CF discipline if clinician-crowd funding ever happens: fabricated metrics would be a securities problem, not just a copy problem). *(startengine)* [ops-dashboard]
- **O5. Methodology blocks under all published metrics** (T8), incl. a live Rule-of-40 composite tile computed from real data. *(aventis, elastic)* [ops-dashboard]

## Part 12 — Homepage & marketing

- **H1. Embed the live product.** The differentiator against enterprise health IT (which communicates in scale claims with zero shown product): the homepage embeds the real readiness surface / live NPI check, not screenshots of claims. *(ttms show-the-product gap; forefront self-service)* [homepage]
- **H2. The sourced stat bank.** Attributed industry pain numbers that require no claims about VitalCV: 2.78 denied claims/week per FTE physician (MGMA); ~$122k lost per 120-day credentialing delay; ~28 admin hrs/week; ~13 credentialing relationships per physician; AAMC's 37,800–124,000 physician shortage by 2034; NCQA's tightened 120/90-day windows. Stat in Fraunces display, citation in mono beneath. *(atlassystems, verisys, chief-healthcare, aappr, medtrainer, andros)* [homepage]
- **H3. The fax-era contrast panel.** Incumbents' own words name the legacy: verification via "phone calls, sending faxes, or mailing written requests"; "paper files, spreadsheets, and email chains"; 73% on legacy systems. A before/after panel (fax-era loop vs source-backed reuse) writes itself. *(atlassystems, medtrainer)* [homepage]
- **H4. Outcome-led, loop-scoped headlines.** "Start sooner" / "Walk in with evidence" — claims the loop, not a verification guarantee. The em-dash time-contrast shape ("days—not months") is truth-contract-safe. Evidence integrity is always the headline; speed is the consequence — never lead with a speed promise a source check can't keep. *(easternstandard; ideon; chief-healthcare anti-pattern)* [homepage]
- **H5. Infrastructure page grammar.** Outcome-led hero; a numbers wall of REAL counts only (source checks run, evidence rows anchored, with as-of dates); docs discoverable in nav but not shouted; alternating real-screenshot + evidence-flow-diagram sections. *(ideon)* [homepage]
- **H6. Public trust-boundary diagram.** A "where your data flows" DFD on the existing canvas-graph language: clinician wallet | VitalCV engine | employer view, separated by drawn trust boundaries; security posture uses the three-state vocabulary (non-/partially/fully mitigated), never a binary "secure" badge. *(owasp threat-model DFD)* [homepage] [public-verify]
- **H7. Category positioning.** "Provider workforce infrastructure" (the highest-multiple category buyers recognize), with credentialing as the beachhead line item — the US credentialing software category (~$268M, ~7% CAGR) is too small to be the story but proves employers already budget for the wedge. A 20+ product healthcare-SaaS landscape contains no clinician-owned credential platform: the white space is citable. *(firstpagesage, grandview, sprypt)* [homepage] [ops-dashboard]

## Part 13 — International clinician wedge

- **I1. Bound document pairs.** Original + word-for-word certified translation render as a linked pair (side-by-side on desktop) sharing ONE evidence status — a translation never floats free of its source document. *(ecfmg)* [readiness] [proof-packet]
- **I2. Translator attestation card.** T4 applied: translator identity + title, letterhead/service, seal presence, certification statement — each element its own checked line. *(ecfmg requirements as a provenance spec; asaptranslate)* [audit-provenance]
- **I3. Upfront rejection rules.** The eligibility checklist renders above the dropzone ("Translations by the applicant are not accepted; summaries not accepted") — preventing the doomed-upload → silent-rejection loop that plagues credentialing. *(ecfmg rejection list)* [readiness]
- **I4. Structured equivalency display.** CTDL-style side-by-side credential mapping (MBBS ↔ MD) with mapped fields, each side carrying its own source — never a free-text "equivalent" claim. *(credentialengine)* [readiness]

## Part 14 — Anti-pattern reject list

What the research says VitalCV must visibly NOT be:

1. **The bare status word.** TopNPI's headline slaps "Verified" on self-reported NPPES data — our banned word is their brand. Never a status without source + timestamp + honest label. *(topnpi)*
2. **The single compatibility score.** "Up to 95% fit accuracy," interview probabilities, fabricated confidence percentages. Reason codes or nothing. *(x0pa)*
3. **Unverifiable superlatives.** "97% reduction," "industry-best accuracy," "cannot be tampered with or hacked," "up to 60%." Measured medians with methodology blocks, or silence. *(providertrust, ideon, everycred, symplr)*
4. **Badge soup.** Walls of HIPAA/SOC2/HL7 logos in place of dated control evidence. Compliance posture = specific control + audit event, shown. *(acropolium)*
5. **The dead artifact.** Buy-once templates and watermarked PDF exports that never update, decay, or revoke (realtimecv's $145 "Vital" template; VisualCV's watermark ransom). Liveness — last-checked lines, accruing staleness, revocation failing closed — must be demonstrated within the first screenful of every share. *(realtimecv, visualcv)*
6. **Dark-pattern account lifecycle.** Hidden cancellation, resurrection billing, exit friction. The export-and-leave door (W7) is the structural answer. *(visualcv reviews)*
7. **Portal-stuffing.** Bolted-together module sprawl sold as "one connected system." One canonical path, few surfaces. *(symplr)*
8. **Dashboard sprawl.** 35 KPIs, zero benchmarks, no opinion. Ship 3–5 opinionated metrics with visible definitions. *(penrod)*
9. **Engagement-mechanic urgency on evidence.** Streak loss, fake countdowns, red-alert abuse, frictionless "no time to think" consent. *(orangesoft, hims)*
10. **Edit affordances on audit surfaces.** An edit button on an audit row is a contradiction; corrections are appended, never overwritten — say so in microcopy. *(dzone)*
11. **Generic failure states.** "Verification failed" without locating the break. Name the event and the mismatch. *(veritaschain)*
12. **Ads or unexplained scores on evidence surfaces.** TopNPI embeds ad blocks and unlabeled quality tiers in provider records — credibility leaks instantly. *(topnpi)*
13. **Icon-only / color-only status.** Every status pairs color with words; custom icons require labels. *(capminds, eleken)*
14. **Crypto bragging.** TPS numbers, chain hype, crypto-flavored language. The chain is the engine, not the headline; trust-relevant figures are finality time and per-anchor cost. *(hedera, zfort)*
15. **Fuzzy identity matching.** A semantic search that ranks an NPI "close enough" is a truth violation (S1). *(zilliz)*
16. **Speed-led claims.** "Completed in a fraction of the time using AI" as the headline. Integrity first; speed as consequence. *(chief-healthcare vendor genre)*
17. **Employer-surveillance framing.** EHR-monitoring-style features that watch clinicians for the employer's gaze. VitalCV signals the opposite: clinician-owned, holder-visible access logs. *(aappr)*
18. **Data-marketplace framing.** "Monetize your credentials data" between institutions. Evidence follows the provider; it is never a product sold between orgs. *(procredex)*
19. **Silent batching/caching presented as live.** If anchoring is batched or a result is replayed, the UI says so (A5, A10). *(edupij, nx)*
20. **The desktop-first hallway product.** The wallet is a phone-in-hallway product; touch targets, mobile forms, per-row skeletons. *(forefront)*

## Part 15 — Prioritized build plan

**P0 — the wedge loop, sharpened (highest leverage, extends existing surfaces):**
1. **Provenance chip system v2** (T1–T3, T6): unify status rendering across wallet/readiness/verify on one component with the mono provenance line and fail-closed register. Foundation for everything else.
2. **Live source-check narration** (M2): the in-hero + readiness "watched it work" run. Already the Living Trust Sprint-2 target; this research fully specs it.
3. **Disclosure composer + share ceremony** (P1–P7, P9): SD-JWT spine/chips/sealed-stubs layout, counterparty-first order, audience presets, per-field consent, terminal receipts.
4. **Freshness system** (R3–R5, E7): regulator-anchored meters, cadence rows, expirables horizon strip, 90/60/30 ladder, consequence-naming stale states. Also the retention engine.
5. **Re-share diff** (E5): "what changed since you accepted" — the acceptance-compounding feature.
6. **Verification transcript + anchoring states** (A2–A5): stepwise mono transcript in AuditProofViewer, user-triggered verify, pinnable roots, pending→anchored dual timestamps.
7. **/verify/[npi] beat-TopNPI spec** (V1–V5): 3-stat header, per-field provenance, "self-reported to NPPES" labels, universal input, two-half verdict, revocation step.

**P1 — the trust relationship deepened:**
8. Consent & shares ledger + viewer activity (W6, W7).
9. Exception-first cockpit: reserved fail-closed band, blocking-conditions panel, disposition-required flags (E1–E4).
10. Requirement profiles → readiness-against-target (R7, E10).
11. Claim ceremony + pending ghost cards (W2, W4, W5, M6).
12. Custody timeline + monitor heartbeat (A6, A7).
13. MATCHA transparency pack (AI1–AI6).
14. Cockpit KPI header + delay-cost tile + funnel attribution (E12, E13).

**P2 — the network told and scaled:**
15. Motion doctrine codified + 1→13 orgs homepage sequence (M1, M4, M5, M7).
16. Public trust-boundary DFD + trust FAQ (H6, V7).
17. International translation-evidence pack (I1–I4).
18. Assurance chips + auth tiering + recovery ceremony (W8, T7).
19. Search honesty architecture (S1–S3).
20. Ops/investor tiles: re-acceptance rate, cohort retention, methodology blocks (O1–O5, T8).

---

## Appendix — research batches & integrity

| Batch | Scope | URLs | Notes |
|---|---|---|---|
| 1 | Healthcare UX / trust centers (hims, Vanta, eleken, orangesoft…) | 10 | all fetched |
| 2 | Credentialing software dev + anti-pattern reviews (realtimecv, visualcv) | 9 | 2 search-fallback |
| 3 | Incumbents (symplr, CAQH, verisys, topnpi, AMA VeriCre…) | 20 | vericre.co is an unrelated real-estate site (unreadable); CAQH now redirects to DataSpring |
| 4 | Immutable architecture / Merkle / chain-of-custody / multi-tenant | 17 | 2 search-fallback |
| 5 | Wallets / SD-JWT / OID4VC / DIDs / NIST / translations | 17 | OpenWallet checklist recovered via raw-file URL — richest single source |
| 6 | Verifier compliance / AI matching / threat modeling | 13 | NCQA 2027 PDF + CISA PDF read in full |
| 7 | Market / valuation / vector search / chains | 14 (1 dup) | 3 search-fallback; edupij chain-benchmark PDF read in full |

Full per-URL findings (status + extracted inspirations) live in the session's agent transcripts; the strongest per-batch "Top 5" lists were merged into Parts 1–14 above.

---

## Addendum — Dribbble harvest, `search/medical-credential-hiring` (2026-08-09)

**Method:** the search page was loaded in the browser pane (it is client-rendered — `WebFetch` returns an empty
document) and the full result grid was read out of the DOM: 48 tiles, each with title, designer, and the
designer's own tag string. Two shots were then opened and viewed directly (EddyNow, Vectorion). Non-essential
cookies were declined. Nothing below is inferred from a title alone; where a shot was not opened, the claim is
limited to what its title and tags state.

**Yield verdict: low. Harvest closed, do not re-run.** Of 48 tiles: 5 are Dribbble's own promos; ~9 are print,
social-ad, logo, or explainer-video work rather than product UI; ~16 are off-topic (dermatology/dental clinic
sites, patient-booking apps, a 3D holographic-imaging site, a skilled-trades marketplace, a tattoo studio).
That leaves ~13 clinician-hiring shots — and exactly **one** shot in the entire result set is about
credentialing itself (R-D1). The query reads as a credentialing query; the corpus is a healthcare-marketing
corpus.

**The visual language is uniformly unusable for us, and this is not a taste call.** Across the relevant shots
the shared register is teal/blue gradient fills, 12–24px rounded cards, bento grids, glass panels, pill
buttons, drop shadows, and stock clinician photography. Every one of those is a *locked* EC-20 rejection
(gradient treatment **None**; glass treatment **None**; pills retired; radius 0–3px; card grammar = solid
hairline-ruled panels, no shadows; illustration = VitalCV's own artifacts, no stock imagery). Nothing in this
addendum proposes a visual treatment. Three **structural** ideas survive.

### Records

- **R-D1 — `Healthcare CMS Web App EddyNow` (Marina Kotenko).** Opened and viewed. The only credentialing
  product in the set. Left rail (Dashboard / Profile / Notifications / Common Form); four counted work tiles
  (`REFERENCE 1`, `DOCUMENTS UPLOAD 3`, `AFFILIATION 7`, `CERTIFICATION 0`); an **Expiration Alerts** panel and
  a **Checklist** panel side by side; and a right-hand **Common Form Status** list — Personal Information /
  Educational Information / Training / Certification / Specialities, each row carrying its own state mark.
- **R-D2 — `AI-Powered Healthcare Recruitment & Provider Matching Platform` (Vectorion Design).** Opened and
  viewed. Stock-photo hero, teal accent, headline "…Career You Want", and a segmented audience control in the
  first viewport (`Healthcare Talent` | `Employer`).
- **R-D3 — the genre's self-description.** Recorded from titles/tags, not opened: `Averdire — SaaS Explainer
  Video for a Verified Hiring Platform`; `MedHire — Global Medical Recruitment`; `Midatec – Healthcare Hiring
  Platform`; `Revolutionizing Hospital Staffing & Management` (tagged `bento cards`, `bento style`);
  `Talentbloom … For Lead Generation`.

### Adopt — three structural ideas

1. **D1. The section-completion ledger** *(from R-D1's "Common Form Status")*. A flat, named list of the
   sections of a clinician's file, each with its own state — rather than a single aggregate figure. This is the
   customer-facing translation we still lack: EC-9 bans *lanes*, *coverage*, *readiness score*, and *passport*
   from customer surfaces, and a plain list of file sections says the same thing in permitted nouns. Serves
   EC-2 principle 5 (work completed over data displayed) and EC-11 (one obvious next action).
   **Amendments, binding:** rows are hairline-ruled, radius 0–3px (EC-20 card grammar); every row is glyph +
   **word**, never the bare red/green dot the shot uses (EC-4, and Part 14 item 13); every asserted row carries
   source + as-of (EC-3, T1, T3); no row may read a bare "Verified" (EC-3). → extends `LaneStateBadge` /
   `FreshnessIndicator`, does not fork them. [readiness] [holder-wallet]
2. **D2. Expiration Alerts as a standing panel** *(from R-D1)*. The shot gives expiry its own named panel
   rather than burying it in a feed. VitalCV already runs an expiration scanner; giving it a first-class home
   surface matches EC-8's "something changed" work state. **Precondition:** the panel renders only rows the
   scanner actually returned — this path has fabricated before (see the `expiration_scanner_fabrication_fixed`
   record). An empty scan renders as an explicit "nothing expiring, checked <date>", never as a hidden panel.
   [readiness] [holder-wallet]
3. **D3. Counted outstanding work, by category** *(from R-D1's four tiles, treatment discarded)*. The idea
   worth keeping is a small count of *outstanding items per category*, which converts a file into a next
   action. The shot's execution is Part 14 item 8 (dashboard sprawl) in gradient tiles — discard it entirely.
   **Amendments:** 3–5 categories maximum, each count defined on hover/inline; a `0` must read as *done*, not
   as *empty*; counts are real returned values (EC-3, numbers animate only between real values). [holder-wallet]

### Considered and rejected — record so it is not re-proposed

- **D4. The hero audience toggle** *(R-D2)*. **Rejected.** It makes the visitor declare an identity before
  receiving anything, which inverts EC-2 principle 4 (value before commitment) and EC-11 asymmetry 1 — the NPI
  field owns the first viewport and returns real state with no account. It also puts two arguments on one
  surface against EC-14. Dual-audience is a real VitalCV doctrine; a first-viewport segmented control is not
  how it gets expressed.
- **D5. The whole visual register.** **Rejected** on the locked EC-20 rows listed above. No amendment is
  sought; recording the rejection so a future wave does not re-litigate it.

### One competitive finding, from the corpus rather than any single shot

"**Verified** hiring platform" is the genre's *default self-description* (R-D3), alongside "Revolutionizing"
and lead-gen landing pages. The bare status word that EC-3 bans outright, and that Part 14 item 1 already
flagged at TopNPI, is not an outlier in this market — it is the category's marketing norm. This strengthens,
rather than complicates, the EC-11 asymmetry 2 position: showing one attributed artifact is differentiating
precisely because asserting is what everyone else does. No new work item; a confirmation of an existing one.

**Non-copy boundary (atlas §10) applies unchanged.** Nothing above copies source, CSS, class names, assets,
compositions, palettes, or copy. Designer and shot names are recorded to attribute a *behavior*.

---

## Addendum — `styles.refero.design` harvest (2026-08-09)

**Method:** the index and one full style document (`Wispr Flow`, 21,091 chars) were read in the browser pane —
the site is client-rendered, and the document body lives in a `<pre>`, not in `innerText`. The index self-
describes as "2,000+ AI-readable design systems… a DESIGN.md you can use in Cursor, Claude Code, Codex, v0, or
Lovable."

**Yield verdict: high — but on FORMAT, not on any catalogued style.** This is not a Dribbble-style aesthetics
corpus. It is a corpus of *agent-facing design documents*, and VitalCV — built by a Claude Code + Codex fleet —
is exactly the consumer they are written for. Every catalogued brand's values, fonts, and copy remain out of
bounds under atlas §10 and EC-20; nothing below proposes adopting any of them.

### The document shape worth stealing (R-R1)

```
# <Name> — Style Reference        + one-line mood + one prose paragraph (the gestalt, before the numbers)
## Tokens — Colors                 table: Name | Value | Token | ROLE SENTENCE
## Tokens — Typography             per face: Substitute / Weights / Sizes / Line height / Letter spacing / Role
### Type Scale                     table: Role | Size | Line Height | Letter Spacing | Token
## Tokens — Spacing & Shapes       Base unit · Density · Spacing scale · Radius PER ELEMENT · Layout
## Components                      per component: **Role:** + exact values + explicit non-negotiables
## Do's and Don'ts                 ### Do / ### Don't
## Surfaces · Elevation · Imagery · Layout
## Agent Prompt Guide              ← written FOR the coding agent
## Quick Start                     ### CSS Custom Properties · ### Tailwind v4
```

### Adopt

- **R1. Every token carries a role sentence, not just a hex.** Refero writes a color's *job and its restraint*
  beside its value — e.g. a CTA fill described as signalling the one clickable thing on a page "without ever
  shouting"; a card radius noted as consistent at every size, "no smaller cards, no exceptions". VitalCV's
  EC-20 table carries values; the when-to-use and when-never lives scattered across Constitution prose,
  wave-1505's do/don't gallery, and component docstrings. Co-locating them is the single highest-value move.
  [design-language]
- **R2. An `Agent Prompt Guide` section.** VitalCV has `AGENTS.md` (merge gate, lane coordination, branch
  cutting, truth contract, banned strings) but it carries **no** design tokens — no colors, no type, no
  spacing. An agent asked to build UI today has no single file to read. [design-language] [ops]
- **R3. Explicit non-negotiables per component.** Stated inline, in the same breath as the values, rather than
  discovered later as a CI failure. This is the human-readable twin of what `check-design-lint` already
  enforces. [design-language]
- **R4. Substitute/fallback faces as a first-class field.** Ours are self-hosted `woff2` via
  `next/font/local` (EC-20) — the fallback chain deserves the same explicitness. [design-language]
- **R5. Radius specified per element**, not as one global scale — cards vs badges vs inputs vs sections each
  get a value. EC-20 locks "near-sharp 0–3px on panels and instruments"; per-element is the resolution an
  implementer actually needs. [design-language]

### Why this matters here, specifically — a measured problem

The audit behind this addendum found the doctrine/reality gap is real and quantified:

1. **No `DESIGN.md` exists** anywhere in the repo.
2. **`AGENTS.md` exists but is design-silent** — it never states a token, face, or scale.
3. **`--vt-*` tokens are declared across six files** in `apps/web` with no documented precedence:
   `styles/themes/index.css` (148) · `styles/vitalTokens.css` (69) · `styles/wave1501-home.css` (47) ·
   `styles/tokens.css` (38) · `styles/matcha-zen.css` (16) · `styles/home.css` (1).
4. **The canonical `DESIGN_SYSTEM.md` documents a token architecture that was never shipped.** It specifies
   `01-primitives.css → 02-semantic.css → 03-themes.css`, "imported in that order." Those three files exist
   **only** under `design-handoff/…/wave1500/` — none is in `apps/web`.
5. **Its values are superseded but still read as current.** wave-1505 specifies Fraunces, matcha `#2c3e2d`,
   and paper-light-only-on-public; EC-20 locks Geist, work-green, and dark as a permitted public register.
   Both documents are on disk, neither points at the other. This cost real time in this very session: the
   StateChip retirement spec needed a whole table explaining which document governs which domain, because
   building straight from the 1505 doc would have shipped the wrong brand.

### The binding constraint on doing this at all

**A hand-written `DESIGN.md` would become the fifth drifting doctrine source, not the fix.** Items 3–5 above
are drift; adding another prose file that restates values by hand reproduces the disease. So:

> `DESIGN.md` must be **generated from the token files and CI-checked against them**, and must state which
> upstream document governs each domain (Constitution EC-20 for brand, wave-1505 for architecture) rather
> than restating either.

That is the difference between a fix and a fifth voice. It also matches the standing rule that citability is
a test, not a claim — a governance doc that cites files which do not exist is precisely the failure recorded
against this repo before.

### Rejected

- **The evocative mood line** as a load-bearing device ("black velvet with violet neon"). It is a
  discoverability affordance for a 2,000-entry catalog, not something a single-brand document needs. One
  plain sentence of gestalt is worth keeping; the poetry is not.
- **Any catalogued style's values.** Fonts in that corpus are licensed to their owners; palettes and
  component specs are theirs. We take the document shape and nothing inside it.

**Non-copy boundary (atlas §10) applies unchanged.** Nothing above reproduces any catalogued brand's tokens,
type, components, or copy. `Wispr Flow` is named to attribute a *document structure*, and short fragments are
quoted only to characterize that structure.

---

## Addendum — Obsidian style record, `refero /style/e793a53c` (2026-08-09)

**Method:** the full 14,840-char style document read in the browser pane.

### Headline: this is a validation of EC-20, not a proposal to change it

Roughly 70% of Obsidian's system is *already* VitalCV's locked direction — and the convergence is on the
**rules**, not just the values:

| Obsidian | EC-20 / EC-14 (already locked) |
|---|---|
| Near-black ground, elevated surface panel | dark warm-graphite ground + panel (public register) |
| System UI font, chosen so the site reads as a tool, not a marketing page | Geist; "no decorative or serif" — same instinct |
| One accent, reserved **strictly** for interactive elements | work-green is the single work color *and* the primary action |
| Elevation without drop shadows | no shadows; hairlines structure panels |
| Graphite borders/dividers | 1px hairlines |
| "Do not use lifestyle photography; focus on the product UI" | EC-14: VitalCV publishes its own artifacts; stock imagery default-rejected |
| Negative tracking at display sizes | EC-20 type anchors |

Its own **Similar Brands** list is Raycast, Linear, VS Code, Superhuman. That is the neighbourhood VitalCV's
locked register already sits in.

### The finding that actually matters — a tension with EC-1, not a compatibility

**Obsidian's register is a power-tool aesthetic. It rewards operation.** Compact density, a 14-step type
ramp reaching 8px, a graph view as hero imagery, "your second brain" — the whole system is built for someone
who *wants* to operate the instrument, and gets better at it over time.

EC-1 says the opposite in as many words: the product must **NOT** primarily feel like "healthcare software you
have to operate"; the target is *calm intelligence doing complicated work for you*, and complexity lives
behind the screen.

So the surface values look compatible while the underlying posture is not. Borrowing more of this register
would pull against EC-1 even though every hex looks on-brand. **That is the trap in this reference**, and it
is worth naming before a wave cites "Obsidian" as a justification for density.

### Adopt — only on rows EC-20 leaves OPEN

These are legitimate raw material because the matching EC-20 row is `PENDING UX-02`, so citing them is not a
Class-B violation:

- **O1. Density, as a named token.** Obsidian declares `Density: compact` and `Base unit: 4px` as first-class
  facts. EC-20's *Product-UI visual density* row is PENDING UX-02. Recording density as an explicit,
  named decision — rather than an emergent property of spacing choices — is the transferable idea. Note the
  EC-1 tension above: evidence that compact *works* is not evidence that compact is *right for us*.
  [design-language]
- **O2. Spacing rhythm as an explicit scale.** EC-20's *Spacing rhythm* row is PENDING UX-02. A published
  4px-based ladder with named tokens is the shape that decision should take. [design-language]

### Candidate EC-22 amendment — flag it, do not smuggle it

- **O3. Elevation by internal luminescence.** Obsidian replaces drop shadows with a 1px inset white line at
  ~5% opacity — no blur, no spread — to define a surface edge on a dark ground.

  **The honest reading is that this is a hairline drawn with light instead of a border colour**, which is what
  EC-20 already mandates ("1px hairlines structure panels and bands"). But EC-20 also locks *"Nothing glows"*,
  and the reference itself calls the effect a glow. A locked row cannot be reinterpreted inside an
  implementation PR — the standing rule is that a locked-row change is amended in the **same** PR that relies
  on it, founder-approved. So: raise as a candidate amendment with the hairline-not-halo argument, get a
  ruling, and only then use it. Do not ship it quietly on the grounds that it is "technically a border."
  [design-language]

### Reject

- **Violet accent, 8–12px radii, and pill tags.** Each collides with a **locked** EC-20 row (work-green as
  the single work colour; near-sharp 0–3px; pills retired). No amendment sought — these are the decisions the
  UX-01 verdict already made.
- **The bottom of the type ramp.** The scale runs to **8px, 9px, 10px, 11px**. VitalCV's legibility floor puts
  body no lower than 12.5px and muted captions no lower than 12px, and EC-5 requires 200% zoom with no clipped
  control. Those four steps are below our floor and are rejected on accessibility grounds, not taste.
- **Its own shadow tokens.** The document says "do not use traditional drop shadows" while shipping
  `--shadow-xl` at `0 20px 25px -5px`. An internal contradiction in the reference; a reminder that a published
  design doc is not self-verifying — which is exactly why the `DESIGN.md` proposal in the previous addendum is
  conditioned on being **generated and CI-checked**, never hand-maintained.

**Non-copy boundary (atlas §10) applies unchanged.** No Obsidian token value, component spec, or copy is
adopted. The brand is named to attribute a *technique* and to record a rejected direction.



---

## Addendum — Steep style record, `refero /style/75fdb89f` (2026-08-10)

**Method:** full 21,667-char style document read in the browser pane.

### Verdict: the closest reference in this corpus so far — on POSTURE

Where Obsidian was a power-tool aesthetic that pulls against EC-1 (see the previous addendum),
Steep is **editorial**, and that is the register EC-1 actually asks for. Its own summary describes
product surfaces "presented as floating artifacts around the headline, not nested in a dashboard
shell" — which is EC-14's own-artifacts default and EC-1's *calm intelligence doing complicated
work for you*, arrived at independently.

It also lands on the register VitalCV has specified **least**. EC-20 mandates a light register for
evidence artifacts, printable surfaces, dense workflow, and legibility-critical contexts — and
then marks its values `PENDING UX-02`. Steep is a fully-worked light, warm-paper, near-achromatic
editorial system. That makes it raw material for an OPEN row rather than a challenge to a locked
one.

### Adopt — as discipline, on open rows

Recorded in the `DESIGN.md` Agent Prompt Guide (`docs/design/design-md-roles.json`), so it reaches
the agents that build surfaces rather than sitting in a doc nobody opens:

- **S1. Spend the accent like a budget.** Steep is ~97% achromatic and rations its one accent to
  *at most once per page, for editorial emphasis only*. VitalCV bans state hues as decoration
  (EC-20) but sets no budget. "At most one chromatic surface per view" is the missing quantity.
- **S2. Elevation is earned by a content class.** Where any lift exists it belongs to the artifact
  being presented, never to ordinary containers. VitalCV's answer is stricter (no shadows), but the
  *principle* sharpens EC-14's "cards earn their box".
- **S3. Tracking tightens as size grows.** A scale-dependent negative letter-spacing ramp. EC-20
  fixes the anchors and leaves the ramp to UX-02 — this is the method that ramp should use.
- **S4. Half-step weights before whole ones.** 430/450/480 as real hierarchy steps. Geist is
  variable; the 400/500/700 ladder is a static-font habit.
- **S5. A link affordance must survive colour removal.** Steep drops rest-state underlines and lets
  an arrow suffix carry the affordance. Compliant with EC-4 *only* because the glyph is non-chromatic
  — worth stating, because "no underline" alone would fail.

### Reject

- **Its values, wholesale.** Signifier serif display, 24px card radius, 9999px pill controls, and
  the peach/brown accent pair each collide with a **locked** EC-20 row (Geist; near-sharp 0–3px;
  pills retired; work-green as the single work colour). No amendment sought.
- **"Never sharp corners."** Steep forbids radii below 16px. EC-20 locks the opposite. This is the
  cleanest illustration of why these documents are harvested for posture and never for numbers.

**Non-copy boundary (atlas §10) applies unchanged.** No Steep token, face, component spec, or copy
is reproduced. The brand is named to attribute a *discipline*, and its rules are paraphrased into
VitalCV's own terms.
