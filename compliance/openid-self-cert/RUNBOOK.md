# OpenID4VC Self-Certification Runbook

## Day-0: Pre-flight Checklist
- [ ] `GET /.well-known/openid-credential-issuer` returns valid JSON with `issuer`, `credential_endpoint`, `jwks_uri`
- [ ] `GET /.well-known/openid-configuration` returns AS metadata with `token_endpoint`
- [ ] `GET /api/.well-known/jwks.json` returns at least one active key
- [ ] Issuer DID consistent across metadata and issued credentials

## Day-1: Metadata Lint
```bash
curl -s https://$ISSUER_BASE_URL/.well-known/openid-credential-issuer | jq .
# Verify: issuer, credential_endpoint, jwks_uri all present
curl -s https://$ISSUER_BASE_URL/api/.well-known/jwks.json | jq .keys[0].kid
```

## Day-2: Token Endpoint Tests
- POST pre-authorized_code grant → access_token + c_nonce
- Verify c_nonce in response body
- Verify expired code returns 400

## Day-3: Credential Issuance Tests
- POST /api/credentials/sd-jwt/issue with valid holderDid + claims
- Verify IssuedSdJwt structure (compact, disclosures, kid, issuedAt, expiresAt)
- Verify undisclosed claims NOT in JWT body

## Day-4: Presentation Tests
- POST /api/validate/sd-jwt with compact + disclosures
- Verify claims extracted, valid=true
- POST /api/validate/presentation with VP wrapper

## Day-5: Negative Tests
- Expired c_nonce → 400 `nonce_expired`
- Reused c_nonce → 400 `nonce_already_used`
- Unknown kid → 400 `No signing key found`
- Wrong aud → 400

## Day-6: Evidence Archive
Archive test outputs to `compliance/openid-self-cert/runs/YYYY-MM-DD/`

## Day-7: Sign-off
Update `compliance/openid-self-cert/STATUS.md`
