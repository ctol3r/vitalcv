# VitalCV Gravity Engine (v3)

## Instant Truth Rendering & Guided Attention
The VitalCV frontend operates under a strict "Gravity Engine" paradigm. The user experience renders the complete, computed truth instantly and uses visual guidance to reduce perceived complexity.

### 1. Atomic Truth Rule (HARD RULE)
**ALL data must be computed BEFORE rendering begins.**
- NO staged fetching.
- NO staged computation.
- NO data mutation between UI steps.
- The Omega Orchestrator must compute the full Manifest and freeze the truth state entirely before the UI receives the payload.

### 2. Flow Structure (Guided Attention Only)
1. **Omega Computes Full Manifest**: Atomic resolution of all truth layers.
2. **UI Renders Full State Instantly**: The complete passport and decision state are rendered immediately without artificial staging or delayed reveal timers.
3. **UI Guides Attention**: The system reduces perceived complexity via:
   - **Highlight**: Directing the eye to critical facts (Identity, Safety, Authority, Decision).
   - **Motion**: Subtle visual cues leading to the primary action.
   - **Emphasis**: Elevating the `NextBestAction` while maintaining full visibility of the evidence.

### Core Rules
- **UI MUST render full passport immediately**: Never delay already-computed truth.
- **No artificial staging**: Withholding data that the backend has already computed to simulate "thinking" or "processing" is strictly forbidden.
- **Guide attention, NOT compute data**: The UI must focus solely on highlighting pre-computed truth. It must never compute new data, fetch incrementally, or manipulate facts.
