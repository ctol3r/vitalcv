# Acquisition funnel — event schema

NUM-1.6. What the clinician acquisition funnel emits, where it goes, and what it
deliberately does not carry.

## Sink

Events flow through `trackFunnelEvent()` in `apps/web/lib/analytics/funnel.ts` to
PostHog. No new vendor was introduced — this is the path the NPI events already
used.

PostHog initialises **only when `NEXT_PUBLIC_POSTHOG_KEY` is set**
(`app/providers.tsx:16`). Without it, `posthog.capture()` is inert and every event
below is a no-op. The instrumentation is therefore code-complete but dormant until
that variable is set in the deploy environment.

A second, first-party path exists — `trackPilotEvent()` →
`POST /api/pilot-ops/events` — which needs no vendor key. It is deliberately
**not** used for funnel steps: splitting one funnel across two sinks makes it
impossible to compute a rate across the join. Use it for pilot-ops signals that
are not funnel steps.

## Events

| Event | Fires when | Properties |
| --- | --- | --- |
| `homepage_viewed` | Homepage mounts, once per mount | — |
| `npi_input_focused` | Hero NPI field first focused | — |
| `npi_submitted` | Hero form passes 10-digit validation | — |
| `results_displayed` | `/passport` reaches a terminal state with a viewable passport | `outcome: 'passport'` |
| `dropoff_detected` | A run ends without a passport (see below) | `last_step`, `dropoff_reason`, `outcome`, sometimes `npi_length` |
| `employer_entry_clicked` | Employer entry beside the clinician action | — |

Every event also carries `funnel_timestamp` and any stored UTM parameters,
attached automatically by `trackFunnelEvent`.

### Drop-off outcomes

`dropoff_detected` distinguishes where a run died:

| `outcome` | `last_step` | Meaning |
| --- | --- | --- |
| `invalid_length` | `npi_input_focused` | Submitted fewer or more than 10 digits — never reached submit |
| `no_profile` | `npi_submitted` | Run completed; no NPPES profile resolved for that NPI |
| `disconnected` | `npi_submitted` | Ingest stream dropped before a usable result |
| `no_anchor` | `npi_submitted` | Run completed with authoritative identity but no anchor entity |
| `error` | `npi_submitted` | Everything else that ended without a passport |

## The funnel

```
homepage_viewed          ← denominator
  └─ npi_input_focused
       ├─ dropoff_detected (invalid_length)
       └─ npi_submitted
            ├─ results_displayed (outcome: passport)   ← conversion
            └─ dropoff_detected (no_profile | disconnected | no_anchor | error)
```

Before NUM-1.6 the first and fourth rows were declared in `FUNNEL_EVENTS` but
never fired from anywhere. With no denominator and no conversion event, no rate
in this funnel was computable — a run that died was indistinguishable from one
that succeeded.

## What these events must never carry

**No NPI value, in any form — including hashed.** A SHA-256 of a 10-digit number
has only 10^10 candidates and is brute-forceable in seconds, so hashing an NPI
does not anonymise it. `hashNpi()` exists in `funnel.ts` and is **not** used by
any funnel event; do not reach for it to make an NPI "safe to send".

`npi_length` is a digit count, not a value, and is the only NPI-derived property
emitted.

No names, no emails, no employer identity. `docs/ops/observability.md` covers the
equivalent rule for error telemetry.

## Consuming this

`scripts/pilot-kpi-report.sh` reads pilot KPIs. The funnel rates above are the
intended source for start-of-funnel reporting once the PostHog key is set.

**FD-3 gate:** no time-to-start or pilot-outcome metric may be derived from these
events and rendered as a public claim until the founder sets the pilot threshold.
Coverage and lane facts only. See the waves 1509–1516 plan.

## Not yet instrumented

Two NUM-1.6 signals remain open:

- **Metric render events** — which numbers rendered, with their source class,
  from `EvidenceMetric`.
- **Chapter-reach depth** — deepest homepage chapter reached, available from
  `ChapterProgress` (`activeId` + `subscribe`).

Both are additive to the schema above and do not change the funnel.
