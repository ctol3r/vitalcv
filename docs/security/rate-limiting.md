# Rate limiting — store, keying, and limits

**Owner:** platform · **Task:** G3 (Wave 1509 · S3) · **Established:** 2026-07-20
**Code:** `apps/api/backend/src/middleware/rateLimitFactory.ts`

---

## 1. Keying — and why the order matters

Buckets are keyed in this order:

| # | Key | Condition |
| --- | --- | --- |
| 1 | `user-<verified sub>` | **only** when `CLERK_JWT_VERIFICATION=enforce` |
| 2 | API key fingerprint | `res.locals.api_key_id` is set |
| 3 | `ip-<client ip>` | fallback |

The response advertises which one was used: `x-rate-limit-scope: user\|api_key\|ip`.

**The enforce condition is the security-relevant part.** `verifiedIdentity` only
overwrites `x-clerk-user-id` with the JWT `sub` — and strips unverifiable identity
headers — in `enforce` mode (`middleware/verifiedIdentity.ts:176,188`). In `off` and
`shadow` that header is caller-supplied. Keying on it there would let an attacker mint
an unlimited number of buckets by rotating a header, which is **strictly worse than no
limiter at all**. So the limiter degrades to IP until G1 flips, and upgrades itself the
moment it does — no second deploy required.

This is locked by `src/middleware/__tests__/rateLimitFactory.test.ts` ("IGNORES
x-clerk-user-id unless verification is enforced").

**IP keying is trustworthy** because `app.ts:3493` sets `app.set('trust proxy', 1)`
(landed in `#586`), so `req.ip` is the real client address behind Railway's proxy rather
than the proxy's own.

---

## 2. Tiers and limits

All windows are 60s, fixed (not sliding).

| Tier | Limit | Applied to |
| --- | --- | --- |
| `credential-status` | 100/min | `/api/credential-status/:artifactId`, `/api/status-list`, `/api/passport/:npi/embed.svg`, `/api/passport/:npi/card.json`, `GET /api/documents/:id` |
| `trust-state` | 60/min | `GET /api/passport/:npi` |
| `wallet` | 50/min | `/api/pilot/acceptance`, `/api/pilot/activate` |
| `proof` | 30/min | `/api/proof/verify`, `/api/passport/:npi/trust`, `/api/passport/:npi/disclose`, `/api/trust-proof/:npi`, `/api/verify-professional` (GET + POST), PSV + PoE lanes |
| `passport-export` | 10/min | `/api/passport/:npi/export` |
| `document-intelligence` | 10/min | `POST /api/documents/parse`, `POST /api/documents/verify` |

Tiers hold **separate stores**, so exhausting one lane cannot deny another.

### What S3 changed

Before this task, **five of the six `/api/passport/*` routes had no limiter at all** —
only `/trust` did. The main record read, selective disclosure, both badge endpoints and
the full export were unmetered on a public, NPI-addressable surface. `verify-professional`
(both methods) and the OCR/AI document lanes were likewise unlimited; the latter had a
standing `TODO (production)` in `routes/documents.ts`.

---

## 3. Response contract

Every response carries:

```
x-rate-limit-limit, x-rate-limit-window-ms, x-rate-limit-remaining,
x-rate-limit-tier, x-rate-limit-scope
```

A refusal is `429` with `Retry-After` (seconds) and:

```json
{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded for passport-export.",
  "tier": "passport-export",
  "limit": 10,
  "windowMs": 60000,
  "scope": "ip",
  "retryAfterSeconds": 37
}
```

`Retry-After` is not decoration: per RFC 9110 §10.2.3 a 429 without it leaves
well-behaved clients guessing, so they retry immediately and amplify the load the limiter
exists to shed. The previous body was a bare `{ error: "Rate limit exceeded for proof" }`
with no header at all.

---

## 4. Store choice — and its honest limitation

**The store is an in-process `Map`.** No Redis dependency exists in this repo, and adding
one is a deployment-topology decision, not a middleware decision.

> **Limitation.** Limits are enforced **per API instance**. With N instances behind the
> Railway load balancer, the effective global limit is **N x the configured limit**, and a
> restart resets every counter. The numbers in §2 are per-instance ceilings, not global
> guarantees.

This is acceptable today because the API runs a single instance, and because the tiers are
sized as abuse-dampers rather than billing meters. It stops being acceptable the moment
the API scales horizontally.

**Upgrade path when it does:** `createTierRateLimiter` already isolates all state behind
`getStore(tier)`. Swapping in a Redis-backed store means replacing that one accessor with
an async driver behind `REDIS_URL`, keeping the in-memory implementation as the fallback
when the variable is unset. Keying, headers, and the 429 contract stay unchanged.

Two other in-memory limiters remain outside this factory —
`middleware/publicSafety.ts` and `middleware/rateLimiter.ts` — each with their own `Map`
and their own thinner 429. Consolidating all three onto one store is the natural companion
to the Redis work; until then, `rateLimitFactory` is the one to extend.

---

## 5. Changing a limit

1. Edit `RATE_LIMIT_CONFIGS` in `rateLimitFactory.ts`.
2. Update the table in §2.
3. If you add a tier, export a prebuilt limiter and extend any route test that mocks the
   module — `src/routes/__tests__/passport.test.ts` stubs it wholesale, and a missing
   export lands as `undefined` in the route chain, which Express throws on at registration.
