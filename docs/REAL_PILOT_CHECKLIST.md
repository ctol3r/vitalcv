# Real Pilot Pre-Flight Checklist

## Before the Call

- [ ] Verify `/api/deploy-info` — SHA matches latest main
- [ ] Run NPI `1003000126` through vitalcv.com — confirm readiness reveals
- [ ] Confirm `/review/request` form submits (test with dummy NPI)
- [ ] Confirm `/pilot-ops` loads and KPI dashboard is accessible
- [ ] Have `MONITORING_SECRET` available for outcome capture
- [ ] Have `./scripts/pilot-kpi-snapshot.sh` ready for quick KPI pull

## During the Call

- [ ] Use a real NPI (not `1003000126` unless demo mode)
- [ ] Screenshot each step (readiness, passport, review, action)
- [ ] Note exact timestamps for TTS calculation
- [ ] Record employer action taken (Proceed / Request Refresh / Route to Review)
- [ ] Note any source lanes showing PENDING or ACCESS-REQUIRED

## After the Call

- [ ] Capture start outcome via API (if start occurred or is confirmed)
  ```bash
  curl -X POST $API/api/internal/pilot/start-outcome \
    -H "Content-Type: application/json" \
    -H "X-Monitoring-Secret: $MONITORING_SECRET" \
    -d '{"entityId":"[ID]","startedAt":"[ISO_DATE]","note":"[notes]"}'
  ```
- [ ] Export KPI snapshot: `./scripts/pilot-kpi-snapshot.sh $SECRET`
- [ ] Create a new evidence file from `REAL_PILOT_EVIDENCE_TEMPLATE.md` with real data
- [ ] Note any source states that were pending/unavailable

## Known Expected States (Not Bugs)

| Source | Expected State | Why |
|---|---|---|
| NPPES | CHECKED | Should resolve for any active NPI |
| OIG/LEIE | CHECKED | Should resolve for any valid NPI |
| PECOS | PENDING (possible) | Quarterly refresh cadence — up to 90 days stale |
| State Board | ACCESS-REQUIRED | Per-state agreements not yet in place for pilot |
