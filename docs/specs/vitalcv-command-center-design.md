# VitalCV Command Center Architecture

## Mission
Design the command center for operators and buyers. The interface must prioritize high-signal data density over aesthetic decoration, serving as a trusted, real-time command surface.

## Constraints
- **Minimal:** No extraneous lines, borders, or shadows. Whitespace and typography define structure.
- **High Signal:** Data density optimized for instant comprehension. Only display actionable or context-critical information.
- **No Decoration:** Eliminate all illustrative graphics. Use semantic colors strictly for status (Red: Action Required, Yellow: Degradation, Green: Healthy - sparingly).
- **Enterprise Clarity:** Unambiguous language, monospace for identifiers, clear hierarchical flows.

---

## 1. Dashboard Layout

The dashboard utilizes a strictly defined, three-column responsive grid to enforce hierarchy and workflow.

- **Global Navigation (Top):**
  - Minimal contextual header: Organization context, environment status (e.g., `[US-EAST | PROD | OPS]`).
  - Search/Command palette trigger: `Cmd+K` default for all global actions.
- **Main Canvas:**
  - **Left Rail (Fixed, 300px):** *Source Coverage & Monitored Providers.* Structural, system-health view.
  - **Center Column (Fluid):** *Alert Feed & Recent Changes.* Action-oriented, temporal workflow area.
  - **Right Rail (Fixed, 350px):** *Trust Score & Readiness Metrics.* Outcome-focused, high-level reporting.

---

## 2. Widget Architecture

Widgets are not "cards" with borders and shadows; they are defined regions of data.

- **Design Language:** True black/white/gray (`#000`, `#FFF`, neutral grays).
- **Header:** Widget Title (12px bold uppercase, e.g., `SOURCE COVERAGE`), optional temporal context (e.g., `LAST 24H`).
- **Body:** Raw data tables, monospace fonts for IDs and metrics, minimal sparklines for trends without axes.
- **Interaction:** Hover reveals deep-link actions (e.g., `View Node`). No decorative buttons; links use a stark `Action →` pattern.
- **Empty States:** Clear, factual text (e.g., `0 Active Alerts`). No illustrative empty states.

---

## 3. Alert Feed

A temporal log of state changes requiring attention or awareness, located in the prominent Center Column.

- **Purpose:** Surface operational friction and critical data shifts instantly.
- **Anatomy of an Alert Row:**
  - `[Timestamp]` (Monospace, e.g., `14:32:01`)
  - `[Severity Indicator]` (1CQ square or circle: Red/Yellow/Gray)
  - `[Entity]` (e.g., `Provider: NPI-12345` or `Source: OIG`)
  - `[Event / Changes]` (e.g., `License Suspended`, `Coverage Dropped`)
  - `[Actionable Link]` (`Resolve →`)
- **Filtering:** Instant, unstyled text toggles for `[All]`, `[Critical]`, `[Warning]`, `[Info]`.

---

## 4. Trust Visualization

Trust is not a gauge or a friendly dial; it is a cryptographic receipt layer. The UI must reflect absolute certainty.

- **The "Trust Score" Widget (Right Rail):**
  - **Primary Metric:** A stark, high-contrast percentage: `99.9% VERIFIED` (Large, clear Grotesque font).
  - **Component Breakdown Bar:** A single, continuous horizontal bar (2px to 4px height):
    - **Solid Black:** Verified by primary invariant source (e.g., State Board).
    - **Dark Gray:** Verified by secondary heuristic/fallback.
    - **Red:** Unverified / Conflicting Data.
  - **Sub-metrics:** 
    - `Total Nodes Evaluated: 14,203`
    - `Nodes with Conflict: 12`
    - `Active Exemptions: 2`

---

## 5. Source Coverage UI

Real-time visibility into the health, freshness, and completeness of the data supply chain (Left Rail).

- **Purpose:** Allow operators to instantly diagnose upstream data failures.
- **Layout:** Dense, borderless table.
- **Columns:**
  - `Source Name` (e.g., `OIG LEIE`, `NPPES`)
  - `Status` (Minimal indicator: `UP` / `DOWN`)
  - `Freshness` (e.g., `Sync'd 2m ago` or `STALE: 48h` colored Red if breached)
  - `Coverage %` (Numerical value, e.g., `85%`)
  - `Changes` (Delta in records since last sync, e.g., `+124 records`)
