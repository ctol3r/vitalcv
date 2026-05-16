# Mock Auth Extinction

Mission:
Remove:
all fake auth surfaces from VitalCV.

Forbidden:
- vcv_mock_jwt
- hardcoded user IDs
- fake session hydration
- setTimeout auth simulation
- fallback auth actors

Operational doctrine:
If auth is unavailable:
- fail closed
- show auth unavailable state
- never fabricate identity

Primary targets:
- sign-in page
- dashboard hydration
- session middleware
- replay attribution
- governance actor extraction
