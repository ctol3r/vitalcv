# TASK 004 — Runtime Dry Boot

OBJECTIVE:
Verify runtime boots correctly with fresh secrets.

COMMAND:
pnpm dev

VERIFY:
1. Next runtime boots
2. Clerk initializes
3. Postgres connects
4. JWKS route initializes
5. replay persistence initializes
6. no fatal hydration errors

SUCCESS CONDITION:
- localhost runtime operational
