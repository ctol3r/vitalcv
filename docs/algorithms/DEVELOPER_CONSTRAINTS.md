# VitalCV Developer Constraints (Gravity Engine Canon)

To structurally enforce the `GRAVITY_ENGINE_CANON` across the frontend, the following development patterns are strictly prohibited. These constraints ensure the UI remains a static, deterministic reflection of the atomic backend truth.

## 1. Forbidden Patterns (Violations)
- **`useEffect` Data Fetching After Mount:** The UI must not request credentials or state asynchronously after the initial render.
- **Incremental API Calls:** UI components must never query secondary APIs to fetch missing claims or limitations.
- **Staged Rendering Flags:** E.g., `if (!showSafety) return null; setTimeout(() => setShowSafety(true), 1000);` is expressly forbidden.
- **Delayed Mounting:** Withholding pre-computed truth to simulate processing.

## 2. Required Pattern (Atomic Rendering)
- **Accept Full Manifest:** All top-level UI pages/components must accept the complete `OmegaDecisionState` or `ProofManifest` as a single synchronous prop.
- **Render Synchronously:** The component tree must fully hydrate from the provided prop without artificial suspense or loading spinners for internal state.
- **Never Trigger Secondary Fetches:** The truth is immutable. There is no "refresh" or "load more" within the bounds of a finalized Manifest payload.

*Any pull request attempting to bypass these constraints via client-side data mutation or asynchronous credential fetching will be rejected.*
