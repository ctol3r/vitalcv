# AGENTS — VitalCV (frontend)
Purpose: VitalCV clinician onboarding & credential verification UI (Next.js).

Key entry points:
- UI: app/, components/, lib/
- API routes: app/api/*

Dev commands:
- pnpm install && pnpm dev
- pnpm test

Conventions:
- TypeScript strict; unit tests for new routes/components
- >10 LOC changes → create PR with summary + test notes
- Never modify .env* or secrets in code

Reviewer: Christopher Toler <christopher.toler@sutterhealth.org>
