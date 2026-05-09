# Operator Overconfidence Review

**Status:** **GOVERNANCE — OVERCONFIDENCE AUDIT** · **Date established:** 2026-05-08 · **Authority:** subordinate to `human-governance-failure-taxonomy.md`, `governance-erosion-escalation.md`

This doc identifies where operators may overtrust dashboards, replay visibility, export completeness, survivability classifications, and containment indicators. It surfaces hidden optimism vectors + silent trust inflation + governance fatigue risks.

---

## 1. The 5 overconfidence vectors

| # | Vector | Optimism risk |
|---|---|---|
| **OO-1** | Dashboard overtrust | "If the widget shows green, we're fine" |
| **OO-2** | Replay-visibility overtrust | "We have replay observability, so we have replay protection" |
| **OO-3** | Export-completeness overtrust | "SIEM has every event" (forgetting DL-8) |
| **OO-4** | Survivability-classification overtrust | "RESILIENT badges mean it won't fail" |
| **OO-5** | Containment-indicator overtrust | "CT-GREEN means containment is active" (when really it means no degradation YET) |

---

## 2. Per-vector audit

### 2.1 OO-1 Dashboard overtrust

**Scenario:** operator reads W-1 CHI = 87 ("HEALTHY") and concludes "no constitutional concerns."

**Reality:** CHI is composite; individual TG dimensions may be DEGRADED. Operator must drill into per-TG status.

**Optimism vector:** composite-only reading without per-dimension review.

**Hidden hazard:** TG-2 (replay) DEGRADED + TG-7 (dashboard) DEGRADED can compound to operationally-significant drift even when CHI is 80+.

**Mitigation:** dashboard widget design surfaces TG dimensions prominently AT same level as CHI; quarterly dashboard review validates per-TG state.

### 2.2 OO-2 Replay-visibility overtrust

**Scenario:** operator reads W-3 widget showing R-OBSERVED + R-DENIED counts and concludes "we're catching all replays."

**Reality:** R-ACCEPTED state has NO marker (per `replay-taxonomy-map.md` §2.3); capture-replay with attacker-chosen correlationId is invisible without payloadHash forensic clustering (which depends on ML-Rec-1).

**Optimism vector:** marker-bearing rows treated as complete picture.

**Hidden hazard:** capture-replay attacks succeed AND go undetected.

**Mitigation:** widget label explicitly says "R-ACCEPTED forensic detection requires payloadHash query" + provides Q-CANON-4 link.

### 2.3 OO-3 Export-completeness overtrust

**Scenario:** SOC analyst queries SIEM stream for incident investigation; concludes investigation complete based on EX-1 results.

**Reality:** DL-8 SIEM coverage gap — T2-direct-writer rows missing. Lock v2 denied-replay rows + employer-review denied audit rows not in SIEM.

**Optimism vector:** SIEM treated as complete audit log.

**Hidden hazard:** investigations conclude on incomplete data.

**Mitigation:** SOC playbook mandates EX-3 cross-check for forensic investigations; widget + dashboard explicit about EX-1 source coverage.

### 2.4 OO-4 Survivability-classification overtrust

**Scenario:** operator reads `operational-guarantee-matrix.md` and sees "C-1 STRONG"; concludes "this can't fail."

**Reality:** STRONG ≠ infallible; per `runtime-trust-class-map.md` §6 there are 5 hidden ambiguities (HCA-1..HCA-5) within C-1. Side-effects are post-tx fire-and-forget. Pre-tx race window exists.

**Optimism vector:** strength label read as guarantee.

**Hidden hazard:** under-investigation when STRONG-classed surface degrades.

**Mitigation:** badges include caveat link; quarterly review of HCA-* hidden ambiguities.

### 2.5 OO-5 Containment-indicator overtrust

**Scenario:** operator reads CT-GREEN and concludes "containment is working."

**Reality:** CT-GREEN means "no degradation detected" — NOT "containment mechanism is active and tested." Containment is invoked WHEN degradation occurs.

**Optimism vector:** absence of degradation read as proof of containment readiness.

**Hidden hazard:** when CT-DEGRADED → CT-FRAGMENTING transition occurs, containment may be untested.

**Mitigation:** quarterly containment-test exercises (controlled drift drills); per-runbook completeness criteria validation.

---

## 3. Hidden optimism vectors

Beyond the 5 explicit vectors, dashboards + telemetry create implicit optimism:

| Vector | Mechanism |
|---|---|
| **HOV-1** | "All widgets green" implies system is operationally certain | Reality: green = within thresholds; thresholds may be wrong |
| **HOV-2** | "No alerts firing" implies no degradation | Reality: alerts depend on detection mechanisms; missed-detection is invisible |
| **HOV-3** | "Codex audit passed" implies PR is constitutionally clean | Reality: Codex catches what the prompt scans for; novel inflation patterns slip |
| **HOV-4** | "CI-grep clean" implies no forbidden phrasing | Reality: allowlist may have grown; manual review of allowlist additions essential |
| **HOV-5** | "Quarterly review found nothing" implies governance is healthy | Reality: review depth depends on reviewer time + attention; deep-rooted drift may not surface |
| **HOV-6** | "Founder approved override" implies it's safe | Reality: founder approval is a containment mechanism, not a survivability proof |

---

## 4. Silent trust inflation patterns

Trust inflation that operators may not notice happening:

| Pattern | Trajectory |
|---|---|
| **TI-1** | Accumulated allowlist entries → "we always allow X" → X becomes accepted |
| **TI-2** | Repeated CT-DEGRADED → operators stop investigating → DEGRADED becomes baseline |
| **TI-3** | Repeated override approvals → override pattern → drift institutionalized |
| **TI-4** | Quarterly review finds no new drift → "governance is settled" → vigilance relaxes |
| **TI-5** | Tests for known patterns pass → "we're test-covered" → novel patterns slip |
| **TI-6** | Dashboard composite metrics smooth out variance → "stable" reading masks individual-dimension drift |

---

## 5. Governance fatigue risks

Beyond alert fatigue (HF-1), broader governance fatigue:

| Risk | Source |
|---|---|
| **GF-1** Reviewer fatigue | High PR volume + lengthy reviewer playbook → shortcuts |
| **GF-2** SOC playbook fatigue | Many runbook scenarios → operators consult less rigorously |
| **GF-3** Founder approval fatigue | Many escalations → approval becomes routine |
| **GF-4** Codex audit fatigue | Long Codex prompts → audit quality degrades |
| **GF-5** Documentation fatigue | 80+ governance docs → operators don't read |
| **GF-6** Lexicon enforcement fatigue | Repeated forbidden-phrase corrections → operators tolerate |

---

## 6. Per-vector mitigation

| Vector | Mitigation |
|---|---|
| OO-1 dashboard overtrust | Per-TG breakdown prominent; CHI not headline |
| OO-2 replay overtrust | R-ACCEPTED forensic-detection link prominent on widget |
| OO-3 export overtrust | DL-8 disclosure on every export-related widget |
| OO-4 survivability overtrust | Strength badges link to caveat (HCA-* / per-handler) |
| OO-5 containment overtrust | Containment-test exercises quarterly |
| HOV-1..6 | Documentation that surfaces "what we don't know" + "what's unverified" |
| TI-1..6 | Quarterly governance review with founder approval audit + allowlist audit |
| GF-1..6 | Per-role training cadence + documentation pruning + automation where safe |

---

## 7. Closing principle (operator overconfidence review)

Overconfidence is the silent partner of constitutional drift. Dashboards + classifications + indicators ENABLE operators; they don't EXEMPT operators from judgment. The vectors named here are real; the mitigations are operator-discipline + dashboard-design + governance-cadence.

**Optimism is human; vigilance is operational. The platform's safety is the product of both.**
