# Wallet / Browser OID4VC Integration Kit

## OID4VCI Pre-Authorized Code Flow
```
1. GET /.well-known/openid-credential-issuer  → metadata
2. POST /api/oid4vci/credential-offer         → { pre_authorized_code, credential_offer_uri }
3. POST /api/oid4vci/credential               → { compact_sd_jwt }
4. Store in wallet, present via OID4VP
```

## OID4VP Presentation
```
POST /api/validate/presentation { vp_token, disclosures }
→ { valid: true, claims: { ... } }
```

## JWKS
`GET /api/.well-known/jwks.json` — always available, no feature flag required.
