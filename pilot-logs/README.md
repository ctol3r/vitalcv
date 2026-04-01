# VitalCV Pilot Feedback Logs

## Quick Start

**Log a session:**
```bash
# Clinician session
cp template.json logs/clinician-2026-04-01-session-1.json
# Edit with actual data
```

**Analyze all logs:**
```bash
python3 analyze.py
```

## Entry Format

```json
{
  "timestamp": "2026-04-01T04:24:00Z",
  "user_type": "clinician|employer",
  "session_id": "unique-id",
  "friction_points": [
    {
      "step": "NPI lookup",
      "description": "User couldn't find NPI field",
      "severity": "high"
    }
  ],
  "trust_issues": ["hesitated to upload license"],
  "time_to_complete_seconds": 342,
  "completed": true,
  "notes": "Overall positive experience"
}
```

## Output

`analyze.py` generates:

- Completion rates by user type
- Average completion times
- Top friction points
- Trust issues identified
- **Top 5 blocking issues**

Saved to: `pilot-logs/summary.json`

## Naming Convention

- `logs/clinician-YYYY-MM-DD-session-N.json`
- `logs/employer-YYYY-MM-DD-session-N.json`
