# Deterministic Continuity Verification
Generated: 2026-05-13T19:05:00Z

---

## Verdict: ALL CRITICAL PATHS DETERMINISTIC

Zero Date.now() entropy in runId derivation. Zero randomUUID in replay chain.

---

## Determinism Audit

### runId Derivation (Critical Path — DB Writer)

```ts
deriveRunId(`${npi}:${startedAt.toISOString()}`)
→ djb2 hash → 8-char hex
```

| Property | Value |
|---|---|
| Input entropy | ✅ None — npi is constant, startedAt is persisted Date |
| Date.now() | ✅ Absent |
| Math.random() | ✅ Absent |
| randomUUID() | ✅ Absent |
| Same inputs → same output | ✅ Always |

### lineageKey Derivation

```ts
`${sourceId}:${subjectNpi}`
```

Derived from immutable DB fields. No entropy.

### priorRunId Chain

```sql
SELECT run_id FROM source_runs 
WHERE subject_npi = :npi AND id != :current 
ORDER BY started_at DESC LIMIT 1
```

Deterministic: same DB state → same result. Order by immutable `startedAt`.

### checkedAt

```ts
(completedAt ?? startedAt).toISOString()
```

Both `completedAt` and `startedAt` are persisted `DateTime` fields. ISO 8601 Z-suffix.

### Integrity Probe (Fixed This Wave)

```ts
LANE_RECEIPT_IDS(npi) = [
  `rcpt_probe_${npi}`,           // stable — NPI only
  `rec-oig-exclusions-probe-${npi}`,
  ...
]
```

Fixed from `rcpt_v1_${npi}_${Date.now()}` → `rcpt_probe_${npi}`. Now deterministic.

### Receipt Route (Fixed This Wave)

```ts
receiptId: `rcpt_${providerId}`,         // was: rcpt_${providerId}_${now}
signingKeyId: 'vcv-es256-dev',           // was: vcv-signing-key-${Date.now()}
```

---

## Remaining Date.now() in Codebase

| File | Line | Usage | Impact |
|---|---|---|---|
| `getReplayInspection.ts:116` | `ts = Date.now()` | Synthetic fallback timestamp for unknown receipt IDs | None — only fires for non-DB paths |
| `getReplayInspection.ts:141` | `Date.now()` fallback | When epoch not found in receipt ID | None — fallback only |
| `getReplayInspection.ts:239` | Anonymous preview `checkedAt` | For completely unknown IDs | None — disclosed as `anonymous_preview` |
| `receipt/route.ts:102` | `now = Date.now()` for checkedAt | Synthetic path `checkedAt` timestamp | Acceptable — this IS when the check happened |

**All Date.now() usages are in synthetic/fallback paths, never in the DB writer.**

---

## Payload Hash Determinism

No payload hash is currently computed or stored. When added, it should use:
```ts
crypto.createHash('sha256').update(JSON.stringify(sortedPayload)).digest('hex')
```
Not yet implemented. Classified as **Absent** in reality state.

---

**SUCCESS: Persisted continuity is reconstructable deterministically from durable state.**
