# VitalCV Repo Salvage Map

## Repositories Reviewed

### 1. ctol3r/v0-vital-cv-frontend-mvp
*   **What it is:** Early v0 Next.js frontend prototyping.
*   **Assets:** UI/UX layouts, early credentialing intake flows, landing page mockups.
*   **Classification:**
    *   **C. Reference Only:** UI aesthetic decisions (liquid glass styling) already ported in wave 121.
    *   **D. Ignore:** Outdated component structures and mock state logic.

### 2. ctol3r/chai-vc-platform
*   **What it is:** The original Verifiable Credentials platform backend (issuance, schemas, OID4VC flows).
*   **Assets:** Core VC signing logic, SD-JWT issuance, revocation registries.
*   **Classification:**
    *   **A. Import Now:** Already fully integrated into `apps/api/backend/` (known locally as `chai-vc-platform-backend`).
    *   **B. Reimplement Cleanly:** Ensure all "Chai" specific branding is abstracted into generic OID4VC/SD-JWT adapter layers within the VitalCV wedge.

### 3. ctol3r/trustgraph
*   **What it is:** A context development platform for structured knowledge and graph-native infrastructure.
*   **Assets:** Trust inference models, graph projection logic, edge generation.
*   **Classification:**
    *   **D. Ignore for now:** Full graph capability expands beyond the current linear "wedge" (NPPES -> Passport -> Employer). Graph copilot logic is explicitly out of scope.

### 4. ctol3r/knowledgebase-docs
*   **What it is:** Knowledge base for compliance, policy, and domain documentation.
*   **Assets:** FCRA mitigation guides, HIPAA applicability assessments, OIG/LEIE disclaimers.
*   **Classification:**
    *   **C. Reference Only:** Legal and compliance research must dictate product wording. Disclaimers already merged.
    *   **B. Reimplement Cleanly:** Any remaining clear-language "Why this matters" product copy for the Holder passport surfaces.

### 5. ctol3r/vitalcv-ai-sandbox
*   **What it is:** Holding pen for Google AI Studio generated components, extraction scripts, and CV parsing LLM prompts.
*   **Assets:** Document intelligence prompts for parsing resumes into structured claims.
*   **Classification:**
    *   **B. Reimplement Cleanly:** The CV parsing prompt structures. We need deterministic extraction logic for Lane B (CV Upload Confidence) without brittle LLM dependencies.
    *   **D. Ignore:** Irrelevant generative AI mockups that don't fit the deterministic trust spine.
