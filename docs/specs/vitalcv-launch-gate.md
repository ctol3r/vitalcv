# VitalCV Launch Gate

**MISSION:** Enforce strict launch discipline. Nothing goes to a live buyer or operator until the product, KPI layer, and commercial language all say the same truthful thing.

## Non-Negotiables
- **Trust first**, matching second, intelligence third.
- **No rebrand work.**
- **No platform sprawl.**
- **No unsupported implication:** if a route, source, billing path, or support motion is not live, the copy must say so plainly.

## Gate A — Product Truth

Launch cannot proceed unless all of the following are true:

- [ ] **Truthful public copy:** the marketing site, `/billing`, and pilot materials only describe live routes, live source coverage, and live buyer motion.
- [ ] **Canonical wedge only:** the live pilot flow remains `/onboarding` → `/passport/[id]` → `/review/[entityId]` → start capture. No demo theater or archived surfaces are used.
- [ ] **Source-health visibility:** every source can appear as `Live`, `Gated`, `Unavailable`, or `Unchecked`. The UI never silently upgrades a gated source to verified.
- [ ] **Packet/export trustability:** the employer packet and pilot KPI exports contain only stored facts, timestamps, and explicit coverage/limitation language. No inferred coverage.
- [ ] **Employer decision persistence:** every employer view, decision, and override writes an audit trail entry before 2xx is returned.

## Gate B — KPI Truth

Launch cannot proceed unless the operational metrics are grounded in real event capture:

- [ ] **One KPI alignment:** every doc and dashboard uses the same core metric: **Interview-to-Start Velocity**, defined as median days from first employer review to recorded start outcome.
- [ ] **Event chain completeness:** review-open, decision, blocker resolution, and start-outcome events all fire on the live path.
- [ ] **Scoped capture discipline:** when operators work inside a pilot scope, manual start capture carries the active `orgContextId`, `pilotId`, `workflowLane`, and `geographyTag` when known.
- [ ] **No inferred filtered starts:** unscoped `start_attestations` are never used to invent filtered pilot results.
- [ ] **Export contract stability:** CSV/JSON exports preserve the applied scope and machine-readable metric rows so contractor handoff and buyer reporting use the same shape.

## Gate C — Buyer And Billing Truth

Launch cannot proceed unless commercial language is equally explicit:

- [ ] **Pricing doctrine is explicit:** buyers only pay for verified pull utility, monitoring refreshes, exports, and integration utility.
- [ ] **No-double-pay is explicit:** repeat access inside the same freshness band is not billed again.
- [ ] **Government fees are explicit:** state/federal access fees are pass-through at cost with no markup.
- [ ] **Checkout truth is explicit:** if public self-serve checkout is not yet live, the UI and pilot materials say so and route to manual invoice/contact flow instead of implying card checkout exists.
- [ ] **Source contracts are explicit:** no price card, quote, or pilot brief implies live Nursys, FSMB, NPDB, DEA, or ABMS coverage unless the contract and connector are both active.

## Required Evidence Before Green Light

Do not mark the gate green without all of the following:

- A pilot KPI snapshot pulled with the intended scope filters.
- A sample CSV export and JSON export generated from the live KPI routes.
- At least one live employer decision audit event.
- At least one recorded start outcome with scoped metadata when the pilot uses scope filters.
- A review of the launch gate, pilot runbook, pilot brief, pricing doctrine, and contractor handoff docs for wording drift.

## Automatic Fail Conditions

Launch is blocked if any of the following are true:

- Public or pilot-facing copy implies live source coverage that is gated or mocked.
- The buyer-facing KPI differs across the brief, runbook, dashboard, or exports.
- A filtered pilot report is built from unscoped starts.
- Pricing copy implies live public checkout when checkout is manual or disabled.
- A contractor or operator could reasonably infer broader geography, source coverage, or compliance scope than the product actually supports.
