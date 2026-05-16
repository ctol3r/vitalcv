# Final Verifier Continuity Audit

## Public Discovery Surface

The following routes are now the canonical verifier discovery set:

- `/.well-known/jwks.json`
- `/.well-known/did.json`
- `/.well-known/openid-credential-issuer`
- `/.well-known/openid-configuration`
- `/.well-known/trust.json`
- `/trust`
- `/trust/graph`
- `/trust/schema`
- `/trust/doctrine`
- `/verify`
- `/api/replay/[runId]`
- `/api/receipt/[lineageKey]`

## Source-Verified Contract

| Endpoint | Expected behavior | Source status |
|---|---|---|
| `/.well-known/jwks.json` | ES256 public key discovery | PASS |
| `/.well-known/did.json` | DID document for `did:web:vitalcv.com` | PASS |
| `/.well-known/openid-credential-issuer` | OID4VCI metadata | PASS |
| `/.well-known/openid-configuration` | Discovery alias for issuer metadata | PASS |
| `/.well-known/trust.json` | Trust manifest and discoverability metadata | PASS |
| `/trust` | Trust register surface | PASS |
| `/trust/graph` | Verifier-readable trust topology | PASS |
| `/trust/schema` | Canonical schema reference | PASS |
| `/trust/doctrine` | Replay and chronology doctrine | PASS |
| `/verify` | Receipt verifier entrypoint | PASS |
| `/api/replay/[runId]` | Replay inspection payload | PASS |
| `/api/receipt/[lineageKey]` | Receipt continuity payload | PASS |

## Live Check Status

The local runtime was not mounted during this sweep, so HTTP 200 verification is pending live execution.

## Verdict

**Verifier continuity discoverability: PASS at source level**

**Live HTTP proof: PENDING**

The relying-party path is fully discoverable from source. Final production proof still requires a mounted runtime.
