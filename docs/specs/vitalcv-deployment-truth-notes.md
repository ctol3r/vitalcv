# VitalCV Deployment Truth Notes

**MISSION:** Maintain absolute honesty about the current state of our deployments to prevent internal and external marketing drift.

## Constraints
- **Trust first**, matching second, intelligence third.
- **No rebrand work.**
- **No platform sprawl.**

---

## Deployment Status Definitions

For every app or marketing site surface, the status must be declared as one of the following:
- **Live:** Actively maintained, truthfully represents current platform capabilities, and used by real users.
- **Archived:** Taken down, codebase frozen, no public routing.
- **Risky:** Currently deployed but heavily misaligned with actual product capabilities (e.g., legacy marketing sites with aspirational claims). 

## Remediation Protocol

**What to do if a "Risky" surface is still deployed:**
1. **Immediate Freeze:** Halt all external traffic routing to the risky marketing or app surface if it violates the `vitalcv-source-coverage-matrix.md`.
2. **Audit & Strip:** Remove all unsupported claims immediately. If the effort to correct the claims exceeds 24 hours, the surface must be taken down (Archived) until compliant.
3. **Gated Relaunch:** Any redeployment must pass the `vitalcv-launch-gate.md` criteria.

## Drift Guardrails

**What repo/docs guardrails prevent stale marketing drift?**
1. **Marketing Copy CI/CD Block:** Public marketing copy must strictly reference the Allowed Public-Marketing Copy strings defined in the Source Coverage Matrix.
2. **Periodic Truth Sweeps:** Routine reviews of the marketing source code against the live API integrations.
3. **Single Source of Truth:** All claims originate from `docs/specs/`. No external slide decks or rogue Notion documents are allowed to redefine capabilities.
