# Runtime Policy Negative Cases

These cases are enforced by runtime middleware in this wave.

## Token Endpoint
- Missing DPoP proof -> `401 dpop_required`
- Missing `request_uri` (PAR) for non-refresh grants -> `400 par_required`
- `code_challenge_method != S256` -> `400 invalid_request`
- Missing `code_verifier` when PKCE inputs are present -> `400 invalid_request`

## Credential Endpoint
- Missing DPoP proof -> `401 dpop_required`
- Access token `aud` mismatch -> `401 invalid_token`
- Missing `c_nonce` -> `400 invalid_nonce`
- Expired `c_nonce` -> `401 invalid_nonce`
- Replayed `c_nonce` -> `401 invalid_nonce`

## Verifier Endpoint
- Missing DPoP proof -> `401 invalid_dpop`
- DPoP `alg != ES256` -> `401 invalid_dpop`
- DPoP `htm`/`htu` mismatch -> `401 invalid_dpop`
- DPoP `iat` outside 60s skew -> `401 invalid_dpop`
- DPoP `jti` replay -> `401 invalid_dpop`
- Access token `aud` mismatch -> `401 invalid_token`
