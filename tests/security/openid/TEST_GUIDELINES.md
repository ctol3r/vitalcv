# VitalCV OpenID Negative Test Requirements

## DPoP Tests
- Valid DPoP -> 200
- Replay DPoP -> 401
- Missing htu -> 401
- Missing htm -> 401
- Expired DPoP -> 401

## Nonce Tests
- Valid nonce -> success
- Replay nonce -> reject
- Expired nonce -> reject
- Missing nonce -> reject

## PKCE Tests
- Correct S256 -> success
- Plain method -> reject
- Incorrect code_verifier -> reject

## Audience Tests
- Exact aud -> success
- Wrong aud -> reject
- Missing aud -> reject

## Clock Skew Tests
- ≤ 60s skew -> accept
- > 60s skew -> reject
- Future iat -> reject

## Algorithm Tests
- ES256 -> accept
- RS256 -> reject
- ES256K -> reject
- none -> reject

## Redirect URI Tests
- Exact match -> accept
- Modified URI -> reject
- Unregistered URI -> reject

PASS CRITERIA:
All negative tests must pass before merge.
