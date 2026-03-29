# VitalCV Pilot Kit
**Last updated:** 2026-03-28 | **Status:** Complete — all artifacts in repo

## One Buyer · One Workflow · One KPI · One Proof Story
- **Buyer:** Healthcare employer (credentialing director / staffing ops)
- **Workflow:** NPI -> readiness -> passport -> employer review -> start outcome
- **KPI:** Time to Start (TTS) — days from first employer review to confirmed start
- **Terrain:** Northern California (default)

## Artifact Inventory

| Artifact | File | Status |
|----------|------|--------|
| Buyer brief (1 page) | docs/PILOT_BUYER_BRIEF.md | Ready |
| Demo script (step-by-step) | docs/PILOT_DEMO_SCRIPT.md | Ready — 4 NPIs, current routes |
| Proof pack (real data) | docs/PILOT_PROOF_PACK.md | Ready — NPI 1003000126 real output |
| ROI narrative | docs/PILOT_ROI_NARRATIVE.md | Ready — $144k-$2.52M model |
| Outreach sequence | docs/PILOT_OUTREACH_SEQUENCE.md | Ready — 10 operators, 3 touches |
| Metric definitions | docs/PILOT_METRIC_DEFINITIONS.md | Ready |
| Proof story template | docs/PILOT_PROOF_STORY.md | Ready — fill after real case |
| Real pilot runbook | docs/REAL_PILOT_RUNBOOK.md | Ready — event chain, curl commands |
| Pre-flight checklist | docs/REAL_PILOT_CHECKLIST.md | Ready |
| Execution tracker | docs/REAL_PILOT_EXECUTION_TRACKER.md | Ready — per-case checkboxes |
| Evidence template | docs/REAL_PILOT_EVIDENCE_TEMPLATE.md | Ready |
| KPI export script | scripts/pilot-kpi-snapshot.sh | Ready |
| KPI report script | scripts/pilot-kpi-report.sh | Ready |
| Pack index | docs/PILOT_PACK_INDEX.md | Ready |

## What Is Still Missing (fill in after first real case)
- Real TTS data (PILOT_PROOF_PACK.md metric table)
- Real buyer org name (PILOT_PROOF_PACK.md header)
- Completed REAL_PILOT_EVIDENCE_TEMPLATE.md instance
- Post-pilot PILOT_PROOF_STORY.md with real numbers

## Quick Start
1. Confirm Railway backend is redeployed from main
2. Use PILOT_OUTREACH_SEQUENCE.md Touch 1 to contact first operator
3. Demo with PILOT_DEMO_SCRIPT.md (NPI 1003000126)
4. Use REAL_PILOT_EXECUTION_TRACKER.md to track the case
5. After pilot: fill REAL_PILOT_EVIDENCE_TEMPLATE.md and update PILOT_PROOF_PACK.md metrics
