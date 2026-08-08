# Migration: `20260808000000_clinician_notification_audience`

Wave N1. Two tables that let VitalCV tell a clinician about their own
credentials. No `prisma migrate dev` was run; the SQL is hand-written with
`CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`. Applied twice
against a fresh Postgres 16: clean on first apply, all-skips on second.

## Why this exists

Before N1, when a clinician's credential neared expiry the daily sweep
emailed their **employers** and an ops inbox. The clinician was not a
recipient anywhere in the system. Their only path to the information was
opening a mobile surface that recomputes notifications per page load and
keeps read state in browser localStorage.

Closing that needs permission, and permission needs a record.

## `clinician_contact_consent_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | UUID PK | app-generated, no DB default |
| `clinician_npi` | TEXT | subject |
| `channel` | TEXT | `EMAIL` (the only channel N1 can deliver on) |
| `kind` | TEXT | `granted` \| `revoked` |
| `seq` | INTEGER | per-(npi, channel) monotonic; **UNIQUE with (npi, channel)** |
| `event_hash` | TEXT | sha256 over the event including its id and seq |
| `grant_source` | TEXT NULL | how the grant was captured, e.g. `holder_settings` |

Append-only. Current state is the highest-`seq` row, never the newest
`created_at` (ms ties are real) or a uuid tiebreak (arbitrary). The unique
index serializes concurrent transitions exactly as the agent consent ledger
does: racing appends compute the same `seq`, one survives, the loser rolls
back whole — audit row included — and retries against the new head.

## `clinician_notification_preferences`

`channels`, `severity_floor` (default `HIGH`), `suppression_window_minutes`
(default 1440), `active`. Shape deliberately mirrors `Watchlist`, which
already established channels + severity floor + suppression window for
org-scoped alerting.

## The distinction these two tables encode

**A preference is not a consent.** Permission to contact at all lives only in
the consent ledger; the preference table routes what is already permitted.
Lowering a severity floor is not permission, and revoking consent is not a
preference.

**A verified email is not permission either.** `PersonProfile.verifiedEmail`
is an OTP possession proof established to corroborate NPI→person binding.
Treating it as a mailing list is a purpose expansion, which is why
`resolveClinicianAlertRecipient` requires a granted consent event *and* a
verified address, and reports them as distinct refusals.

## Writers and readers

- **Writer: the web app.** `apps/web/lib/clinician-notifications/consent-store.ts`,
  audit-paired in one transaction. Models are mirrored into
  `apps/web/prisma/schema.prisma`.
- **Reader: the backend sweep.** `clinicianAlertRecipient` /
  `clinicianAlertDispatch`, consumed by `continuousMonitor`.

## Rollback

```sql
DROP TABLE IF EXISTS "clinician_contact_consent_events";
DROP TABLE IF EXISTS "clinician_notification_preferences";
```
