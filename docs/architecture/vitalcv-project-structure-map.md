# VitalCV Project Structure Map

## Monorepo Root (`/Users/christoler/vitalcv`)
**Purpose:** Canonical repository for VitalCV.
**Owner Concern:** Chris Toler (Founder)

### Apps
* `apps/web`
  * **Purpose:** Canonical public frontend and verifier console.
  * **Status:** Canonical. Actively deployed.
  * **Action:** Maintain as primary entry point.
* `apps/api` (Specifically `apps/api/backend`)
  * **Purpose:** Canonical backend engine, GraphQL layer, PSV integrations, and database connection.
  * **Status:** Canonical. Actively deployed.
  * **Action:** Maintain.
* `apps/marketing`
  * **Purpose:** Old marketing site.
  * **Status:** Legacy / Non-canonical. (`LEGACY_NOT_DEPLOYED.md` exists).
  * **Action:** Ignore / Do not deploy. `apps/web` handles public routes.

### Packages
* `packages/trust-state`
  * **Purpose:** Core type definitions and interfaces for the Trust Object and evidence layers.
  * **Status:** Canonical.
* `packages/psv`
  * **Purpose:** Primary Source Verification (PSV) adapter libraries.
  * **Status:** Canonical.
* `packages/domain-common`
  * **Purpose:** Shared utilities and domain models.
  * **Status:** Canonical.

### Docs
* `docs/gtm`
  * **Purpose:** Go-To-Market assets, sales kits, and pilot tracking.
  * **Status:** Canonical.
* `docs/specs`
  * **Purpose:** Product requirements and feature specifications.
  * **Status:** Canonical.
* `docs/ops`
  * **Purpose:** Operations, completion boards, and wave templates.
  * **Status:** Canonical.
* `docs/architecture`
  * **Purpose:** System maps and knowledge graphs.
  * **Status:** Canonical.

### Vercel Deployment Map
* `vcv-web`
  * **Purpose:** The production frontend Vercel project serving `vitalcv.com`. Maps directly to `apps/web`.
  * **Status:** Canonical.
* `vitalcv-marketing` / `staging`
  * **Status:** Legacy / Tangled projects.
  * **Action:** Route all production traffic through `vcv-web`.
