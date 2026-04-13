# VITALCV TRUST MANIFEST IMPLEMENTATION PLAN

## ALIGNMENT WITH SYSTEM COMPLETION (PHASE 3)
The Trust Manifest provided by the user outlines 7 comprehensive waves of productization. This overlaps heavily with our ongoing `SYSTEM COMPLETION` directive, but massively expands the UI/UX scope (Liquid Glass Design System, Mobile-first bottom sheets, Wallet UI, Command Palettes, etc.).

Since we are currently executing **SYSTEM 3 — EMPLOYER LOOP** and the user has just dropped the master UI/UX manifest, we must adapt our execution. 

### THE NEW DIRECTIVE:
We will pause the purely backend-focused "System Completion" sequence to integrate the **Wave 0 (Foundation: Design System & Infrastructure Hardening)** and **Wave 1 (Holder Identity Layer)** from the new Trust Manifest. This ensures the frontend glassmorphism, responsive grids, and wallet UIs are in place before we wire the final Employer and Trust Graph data.

---

### EXECUTION SEQUENCE (TRUST MANIFEST ADAPTATION)

#### **1. WAVE 0 — FOUNDATION (Design System & Mobile Overhaul)**
*Branch:* `feature/manifest-wave0-foundation`
*   **0.1 Liquid Glass:** Implement `<GlassCard>`, `<GlassPanel>`, `<GlassModal>` using existing `oklch` tokens. Add view-transition theme animations and `<Skeleton>` loaders.
*   **0.2 Navigation Power Tools:** Wire up the `⌘K` Command Palette and global keyboard shortcuts. Add ARIA labels and focus rings.
*   **0.3 Mobile-First:** Refactor `/passport` and `/wallet` for 375px breakpoints. Implement the swipe-up bottom sheet navigation for the credential wallet.

#### **2. WAVE 1 — HOLDER IDENTITY LAYER (Wallet & Onboarding)**
*Branch:* `feature/manifest-wave1-wallet`
*   **1.1 Credential Wallet:** Build `/dashboard/wallet` with the `<CredentialCard>` (showing cryptographic signatures and freshness). Implement the SVG/Canvas CRS radial gauge.
*   **1.2 Selective Disclosure:** Build the claim-level toggle matrix for sharing, the QR code generation for SD-JWT presentations, and the presentation history log.
*   **1.3 Onboarding Wizard:** Build the 6-step `/onboarding` route (NPI → Source Linkage → Wallet Provisioning → CRS Reveal).
*   **1.4 Multi-State Map:** Build the D3/react-simple-maps interactive US choropleth map for licensure.

#### **3. WAVE 2 — VERIFIER SURFACE (Employer Compliance)**
*Branch:* `feature/manifest-wave2-employer`
*   **2.1 Compliance Dashboard:** Build `/dashboard/employer` with the provider roster table, compliance heatmap, and metrics bar.
*   **2.2 Decision Kanban:** Build the drag-and-drop provider pipeline (Ingested → Review → Approved).
*   **2.3 Audit Trail:** Build `/dashboard/audit` to view the immutable event log and Merkle proofs.

*(Waves 3-7 will follow sequentially once the core UI and Employer surfaces are locked in).*
