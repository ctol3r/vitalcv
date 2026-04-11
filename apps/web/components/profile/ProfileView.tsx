/**
 * ProfileView
 * ───────────
 * The canonical "provider profile" surface. This is the first place in the
 * VitalCV web app where three things converge into one coherent display:
 *
 *   1. Identity      (who the provider is)
 *   2. Enrichment    (what on-device AI inferred about them)
 *   3. Confidence    (how much to trust each datum, per-field)
 *
 * This is the "butter experience" surface — where clinicians understand
 * themselves and employers understand the provider instantly. Changes to its
 * invariants should be treated as product-level decisions, not styling.
 *
 * ─ Invariants enforced here ────────────────────────────────────────────────
 *
 *   (I1) Ordering is deterministic at the DATA layer: verified → inferred →
 *        unknown, via `orderEntriesByConfidence`. Input key order only
 *        controls within-rank ties. Do NOT re-sort in render.
 *
 *   (I2) Every field renders through <FieldConfidenceBadge />. There is exactly
 *        one field-row code path in this file — adding a second one would
 *        risk emitting a bare value without a badge, which is a compliance
 *        violation. Don't add a second path.
 *
 *   (I3) Null/missing fields still render through viewField(), which
 *        guarantees an "unknown"-typed view. The UI shape is stable even
 *        when enrichment produced no value.
 *
 * ─ Explicit non-goals ──────────────────────────────────────────────────────
 *
 *   - ProfileView does NOT render the NCQA check-level verdict. That lives in
 *     DecisionBlock (READY / CONDITIONAL_READY / NOT_READY) and answers a
 *     different question ("can this provider move forward?"). The two must
 *     remain separate systems — check-level vs field-level provenance.
 *
 *   - ProfileView does NOT group fields into semantic sections yet. Grouping
 *     is deferred to a follow-up iteration once real enrichment data is in.
 *     The current surface is a single ordered list; promoting to sectioned
 *     layout means wrapping multiple <ProfileView>s or extending the props.
 *
 * ─ Rendering mode ─────────────────────────────────────────────────────────
 *
 *   This is a React Server Component. The confidence view projection lives
 *   in `lib/profile/confidenceView.ts` (pure, server-safe), so no 'use client'
 *   directive is needed. Do NOT add state, effects, or event handlers to this
 *   component without first promoting the stateful bits to a child client
 *   component — ProfileView's job is structural, not interactive.
 */

import type { ConfidenceField } from '@domain-common/dataConfidence';

import {
  viewField,
  type FieldConfidenceView,
} from '@/lib/profile/confidenceView';
import { orderEntriesByConfidence } from '@/lib/profile/orderByConfidence';

import { FieldConfidenceBadge } from './FieldConfidenceBadge';

// ── Props ──────────────────────────────────────────────────────────────────

export interface ProfileViewProps<K extends string> {
  /**
   * Record of confidence-wrapped fields, keyed by a stable identifier.
   *
   * Any key mapped to `null` or `undefined` collapses to an "unknown" view
   * via the safety net in `viewField` — the row still renders, with an
   * Unknown badge, so the profile shape is stable across providers with
   * varying enrichment coverage.
   */
  fields: Readonly<Record<K, ConfidenceField<unknown> | null | undefined>>;

  /**
   * Human-readable labels, keyed by the same identifiers. Required — the
   * generic `K` binds this record to `fields` so TypeScript will reject any
   * profile that forgets a label.
   */
  fieldLabels: Readonly<Record<K, string>>;

  /** Headline shown above the field list. Defaults to "Provider profile". */
  title?: string;

  /** Optional subheadline (e.g. provider specialty, NPI, clinic name). */
  subtitle?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ProfileView<K extends string>({
  fields,
  fieldLabels,
  title = 'Provider profile',
  subtitle,
}: ProfileViewProps<K>) {
  // (I1, I3) Project every key into a view. Missing/malformed fields become
  // "unknown"-typed views so the row is still rendered downstream — no field
  // is silently dropped.
  const keys = Object.keys(fields) as K[];
  const entries = keys.map<[K, FieldConfidenceView<unknown>]>((key) => [
    key,
    viewField(fields[key] ?? null),
  ]);

  // (I1) Deterministic ordering lives in the data layer, not this component.
  // We pass entries in caller-supplied order; the stable sort preserves that
  // ordering within each confidence rank.
  const ordered = orderEntriesByConfidence(entries);

  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-white/8 bg-black/20 px-6 py-6"
    >
      {/* Header */}
      <header className="mb-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
          {title}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>
        )}
      </header>

      {/* Field list — single code path, single badge site (I2). */}
      <ul className="divide-y divide-white/6">
        {ordered.map(([key, view]) => (
          <ProfileFieldRow
            key={key}
            label={fieldLabels[key]}
            view={view}
          />
        ))}
      </ul>

      {/* Compliance footer. Kept intentionally low-weight; the per-field
          tooltip is the primary compliance surface, this line is reassurance
          for readers scanning the whole profile. */}
      <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground/50">
        Inferred fields are derived from available data and are not
        source-verified. Verified fields come from primary sources (NPPES,
        state boards).
      </p>
    </section>
  );
}

// ── Field row (the ONE sanctioned render path — see I2) ────────────────────

interface ProfileFieldRowProps {
  label: string;
  view: FieldConfidenceView<unknown>;
}

function ProfileFieldRow({ label, view }: ProfileFieldRowProps) {
  const display = formatFieldValue(view);

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          {label}
        </p>
        <p className="mt-1 break-words text-sm text-foreground/90">
          {display}
        </p>
      </div>
      {/* (I2) The badge is NOT optional. Every row emits one. */}
      <FieldConfidenceBadge view={view} className="mt-1 shrink-0" />
    </li>
  );
}

// ── Value formatter (learning-mode contribution point) ────────────────────
//
// TODO(learning-mode): This is the single most UX-shaping decision in
// ProfileView — how do we render a field's VALUE in the "butter experience"
// slot? The right answer depends on decisions about null handling, type
// coercion, date formatting, and truncation that can't be made without seeing
// real enriched passport data from the on-device pipeline.
//
// Trade-offs to consider (pick what matches the brand posture, then iterate):
//
//   (a) Null handling:
//       - "—" (em dash): minimal, honest, always the same width.
//       - "Not available": verbose; can read like a system error.
//       - "Unknown": duplicates the badge label for Unknown-typed rows,
//         which creates redundant noise.
//
//   (b) Non-string values (Date, number, boolean, object):
//       - Delegate to `String(value)` and trust callers to pre-format.
//         (Simpler contract; risk of "[object Object]" in production.)
//       - Type-switch here on primitive vs Date vs object.
//         (More robust; more code to maintain.)
//
//   (c) Long strings (addresses, bios, sanctions notes):
//       - Truncate with ellipsis + move full value to title attr.
//         (Compact but requires width tuning per surface.)
//       - Wrap across multiple lines.
//         (Canonical but breaks row alignment in dense layouts.)
//
//   (d) Source echo:
//       - Append source label (e.g. "Jane Doe · NPPES") for verified rows.
//         (Redundant with the badge tooltip but visually immediate.)
//       - Keep source inside the tooltip only.
//         (Cleaner; requires hover for full provenance.)
//
// The stub below makes the safest v1 choice: String coercion + em dash for
// null. It is deliberately insufficient for the "butter experience" bar.
// Replace it with ~5–10 lines that match how the canonical profile should
// feel once you've seen the first real enrichment output.
//
// Returns a string so the row layout stays stable. Promote to ReactNode if
// you need to embed inline elements (e.g. a copy-to-clipboard affordance on
// NPI numbers).
function formatFieldValue(view: FieldConfidenceView<unknown>): string {
  if (view.value === null || view.value === undefined) return '—';
  return String(view.value);
}
