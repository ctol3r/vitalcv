/**
 * FOUNDATION-SWEEP-2 — accessibility foundation checklist.
 *
 * Truth invariants:
 *   - This is a baseline self-check, NOT a WCAG 2.2 AA certification.
 *   - The checklist's purpose is to make missing accessibility work
 *     visible per route; it does not assert any audit result.
 *   - Each requirement can be `pass`, `partial`, `missing`, or
 *     `not_applicable`. There is no `complete` status — even an
 *     all-pass checklist is still a baseline, not certification.
 */

export type AccessibilityCheckStatus =
  | 'pass'
  | 'partial'
  | 'missing'
  | 'not_applicable';

export type AccessibilityCategory =
  | 'semantic_headings'
  | 'form_labels'
  | 'help_error_text'
  | 'keyboard_navigation'
  | 'focus_visibility'
  | 'touch_targets'
  | 'contrast'
  | 'reduced_motion'
  | 'screen_reader_labels';

export interface AccessibilityRequirement {
  category: AccessibilityCategory;
  label: string;
  /** What "pass" looks like for this category at the foundation level. */
  passCondition: string;
}

export interface AccessibilityFinding {
  category: AccessibilityCategory;
  status: AccessibilityCheckStatus;
  /** Why this status was assigned (≤120 chars; UI-safe). */
  note: string;
}

export interface AccessibilityFoundationChecklist {
  route: string;
  requirements: AccessibilityRequirement[];
  findings: AccessibilityFinding[];
  /**
   * Human-readable phase label for the route. Derived from the
   * findings (e.g. "foundation_started", "foundation_in_progress",
   * "foundation_baseline_met"). NEVER "WCAG AA complete".
   */
  phase: 'foundation_not_started' | 'foundation_in_progress' | 'foundation_baseline_met';
  /** Disclaimer the UI must render verbatim. */
  disclaimer: string;
}

const REQUIREMENT_DEFS: AccessibilityRequirement[] = [
  {
    category: 'semantic_headings',
    label: 'Semantic headings',
    passCondition: 'Page uses h1/h2/h3 in document order; one h1 per route.',
  },
  {
    category: 'form_labels',
    label: 'Form labels',
    passCondition: 'Every input has an associated <label> or aria-label.',
  },
  {
    category: 'help_error_text',
    label: 'Help and error text',
    passCondition: 'Inputs reference help/error text via aria-describedby; errors are announced.',
  },
  {
    category: 'keyboard_navigation',
    label: 'Keyboard navigation',
    passCondition: 'Every interactive control is reachable and operable by keyboard alone.',
  },
  {
    category: 'focus_visibility',
    label: 'Focus visibility',
    passCondition: 'Focused elements have a visible focus ring at AA contrast.',
  },
  {
    category: 'touch_targets',
    label: 'Touch targets',
    passCondition: 'Interactive targets are at least 44×44 CSS px on touch viewports.',
  },
  {
    category: 'contrast',
    label: 'Contrast',
    passCondition: 'Text and meaningful UI surfaces meet WCAG AA contrast.',
  },
  {
    category: 'reduced_motion',
    label: 'Reduced motion',
    passCondition: 'Animation respects prefers-reduced-motion: reduce.',
  },
  {
    category: 'screen_reader_labels',
    label: 'Screen reader labels',
    passCondition: 'Decorative images are aria-hidden; meaningful regions have aria-labels.',
  },
];

const DISCLAIMER =
  'This is an accessibility baseline self-check. It is not a WCAG 2.2 AA certification or audit result.';

export function explainAccessibilityRequirement(
  category: AccessibilityCategory,
): AccessibilityRequirement {
  const requirement = REQUIREMENT_DEFS.find((r) => r.category === category);
  if (!requirement) {
    throw new Error(`Unknown accessibility category: ${category}`);
  }
  return requirement;
}

export function buildAccessibilityFoundationChecklist(
  route: string,
  findings: AccessibilityFinding[],
): AccessibilityFoundationChecklist {
  const requirements = REQUIREMENT_DEFS.slice();
  const phase = getAccessibilityPhaseForRoute(findings);
  return {
    route,
    requirements,
    findings: [...findings],
    phase,
    disclaimer: DISCLAIMER,
  };
}

export function getAccessibilityPhaseForRoute(
  findings: readonly AccessibilityFinding[],
):
  | 'foundation_not_started'
  | 'foundation_in_progress'
  | 'foundation_baseline_met' {
  if (findings.length === 0) return 'foundation_not_started';
  const relevant = findings.filter((f) => f.status !== 'not_applicable');
  if (relevant.length === 0) return 'foundation_not_started';
  const allPass = relevant.every((f) => f.status === 'pass');
  if (allPass) return 'foundation_baseline_met';
  const anyPass = relevant.some((f) => f.status === 'pass' || f.status === 'partial');
  if (anyPass) return 'foundation_in_progress';
  return 'foundation_not_started';
}
