# Authz Service

Authorization service with DPoP and mTLS token binding support.

## B99A-TBIND-001: DPoP Default; mTLS Enterprise-Optional

### Overview

This service implements sender-constrained token binding per OAuth 2.0 DPoP (RFC 9449) and mTLS (RFC 8705) specifications.

### Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `MTLS_REQUIRED` | `false` | Set to `true` to require mTLS for all confidential clients (enterprise mode) |
| `MTLS_ALLOWED_FOR_CONFIDENTIAL` | `true` | Set to `false` to disable mTLS for confidential clients (forces DPoP) |
| `DPOP_REQUIRED` | `true` | Set to `false` to disable DPoP requirement (not recommended for wallets) |

### Behavior

#### Wallet Clients (Default)
- **Always require DPoP** with `cnf.jkt` in access token
- Bearer-only tokens are rejected
- DPoP proof must include:
  - Valid JWS signature
  - `htu` matching request URL
  - `htm` matching HTTP method
  - `iat` within 60 seconds (clock skew tolerance)

#### Confidential Clients
- Can use **mTLS** if `MTLS_ALLOWED_FOR_CONFIDENTIAL=true` (default)
- Can use **DPoP** as alternative
- Enterprise mode: Set `MTLS_REQUIRED=true` to enforce mTLS for all confidential clients

### Endpoints

#### POST /token
Issues access tokens with sender-constrained binding:
- Wallet clients: Returns token with `cnf.jkt` claim
- Confidential clients: Returns token with mTLS binding or `cnf.jkt` (DPoP)

#### POST /credential
Credential endpoint that requires sender-constrained tokens:
- Rejects bearer-only tokens
- Accepts DPoP-bound tokens (wallet clients)
- Accepts mTLS-bound tokens (confidential clients)

### Example Usage

#### Wallet Client (DPoP)
```bash
# 1. Generate DPoP proof
DPOP_PROOF=$(generate-dpop-proof \
  --htu "https://issuer.example.com/credential" \
  --htm "POST" \
  --jwk "$WALLET_JWK")

# 2. Request credential with DPoP
curl -X POST https://issuer.example.com/credential \
  -H "Authorization: DPoP $ACCESS_TOKEN" \
  -H "DPoP: $DPOP_PROOF" \
  -H "X-Client-Type: wallet"
```

#### Confidential Client (mTLS)
```bash
# Request with client certificate
curl -X POST https://issuer.example.com/credential \
  --cert client.crt \
  --key client.key \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "X-Client-Type: confidential"
```

### Security Notes

- DPoP proofs are validated for signature, URL/method binding, and freshness
- mTLS certificates should be validated against trusted CA in production
- Clock skew tolerance: 60 seconds (configurable)
- Replay protection: DPoP `iat` must be within skew window

