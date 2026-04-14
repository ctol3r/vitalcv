# VitalCV Multi-Agent Analysis Prompts
Run these inside `~/vitalcv` (or via their respective agent interfaces) to perform a holistic audit of the VitalCV codebase and live site.

## 1. Claude Code (Codebase Audit & Architecture)
*Purpose: Deep analysis of backend infrastructure, routing continuity, and API security.*
```bash
claude -p "Audit the ~/vitalcv Next.js monorepo. Focus on three things: 1) Auth boundaries—ensure no routes under /api/passport or /api/readiness are leaking PII when accessed anonymously. 2) State hydration—verify that the NPI context correctly carries from the Homepage hero component all the way through to /review/[entityId]/ReviewPageClient.tsx without dropping state. 3) Database calls—check Prisma schema queries in /backend/src/ for N+1 issues or excessive external API re-fetches (e.g. hitting NPPES when cache is still fresh). Output a concise markdown report with exactly where any architectural leaks exist."
```

## 2. Claude Browser (Production Site Verification)
*Purpose: Headless browser automation checking the live wedge flows on `vitalcv.com`.*
```bash
claude -p "Navigate to https://vitalcv.com. Act as an unauthenticated clinician. Find the NPI entry field in the hero. Enter a real test NPI (e.g., 1457313889) and click 'Check Readiness'. Wait for the API to resolve. Confirm that: 1) the identity matches the NPI exactly (no 'Sarah Chen' demo names), 2) you successfully land on the /passport route without seeing 'organization_context_required' 500 errors, and 3) clicking 'Employer View' or 'Review' asks for sign-in or tenant setup rather than crashing. Report your step-by-step navigation path and any console errors."
```

## 3. Codex (Trust Graph & Data Structure Analysis)
*Purpose: Graph substrate modeling and advanced recursive query inspection.*
```bash
codex "Analyze the GraphNode and GraphEdge substrate inside apps/api/backend/prisma/schema.prisma and the corresponding graphSyncEngine.ts in ~/vitalcv. Specifically evaluate the recursive CTE logic used to traverse Provider → Claim → Evidence → Source. Is the current metadata JSONB payload sufficient to handle 'DIVERGENCE' node intersections without performance degradation? Propose a more efficient SQL index or caching layer if the current traversal for the 'Why this score?' UI component is inefficient at scale."
```

## 4. Claude Cowork (Product & UI/UX Cohesion)
*Purpose: Collaborative product critique, ensuring the UI communicates 'Palantir seriousness' and 'Stripe discipline'.*
```bash
claude -p "You are a senior product designer. Review the UI components in ~/vitalcv/apps/web/components/ (specifically the TrustSummary, EvidenceExplorer, and WhyThisScore components). Cross-reference them against the visual doctrine described in CLAUDE.md. Are we adhering to 'Stripe discipline' and 'Palantir seriousness'? Identify any components that still feel like a 'generic AI playground' (e.g., unnecessary generative spinners, empty loading states, or overly consumer-y animations). Suggest strict CSS or layout modifications to make the Employer Review dashboard feel 100% operational and audit-ready."
```
