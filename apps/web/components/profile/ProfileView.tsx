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

  /**
   * When true, every row appends ` · ${sourceLabel}` to its display value.
   * Off by default — the source already lives in the badge tooltip; this is
   * an opt-in debugging affordance for QA, screenshots, and pilot review
   * sessions where the canonical surface needs to be readable in print.
   */
  debug?: boolean;
}

// ── Component ──────────────────────────────────────────────────────────────

export function ProfileView<K extends string>({
  fields,
  fieldLabels,
  title = 'Provider profile',
  subtitle,
  debug = false,
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
            debug={debug}
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
  debug: boolean;
}

function ProfileFieldRow({ label, view, debug }: ProfileFieldRowProps) {
  const { display, full } = formatField(view, { debug });
  // Surface the untruncated text via title attr only when truncation actually
  // hid something. Avoids a noisy redundant tooltip on short, fully-visible
  // values, and keeps the badge's compliance tooltip the only hover affordance
  // on rows where there's nothing extra to reveal.
  const valueTitle = display !== full ? full : undefined;

  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
          {label}
        </p>
        <p
          className="mt-1 break-words text-sm text-foreground/90"
          title={valueTitle}
        >
          {display}
        </p>
      </div>
      {/* (I2) The badge is NOT optional. Every row emits one. */}
      <FieldConfidenceBadge view={view} className="mt-1 shrink-0" />
    </li>
  );
}

// ── Value formatter ───────────────────────────────────────────────────────
//
// Resolves the "butter experience" value-rendering decision laid out in the
// original TODO. The chosen posture for v1:
//
//   (a) Null handling      → em dash '—'. Same width everywhere, no system-
//                            error voice, doesn't shadow the Unknown badge.
//   (b) Non-string values  → typed switch (string / number / boolean / Date /
//                            array / object). Delegating to `String(value)`
//                            is too risky once domain models start carrying
//                            Dates and nested objects — '[object Object]' is
//                            a compliance smell, not a UX bug.
//   (c) Long strings       → hard truncate at TRUNCATE_AT with U+2026 and a
//                            `title` attr exposing the full value (see
//                            ProfileFieldRow). Wrapping was rejected because
//                            it breaks the deterministic row alignment that
//                            makes verified/inferred rank visually scannable.
//   (d) Source echo        → off by default. The badge tooltip already names
//                            the source. The `debug` prop opts in to inline
//                            ` · {sourceLabel}` for QA, screenshots, and
//                            print-friendly review sessions.
//
// Returns `{ display, full }` so the row can wire up the truncation tooltip
// without re-running the formatter or duplicating logic. Promote either field
// to ReactNode at the call site if you ever need inline elements (e.g. a
// copy-to-clipboard button on NPI numbers) — the formatter contract stays
// pure and deterministic.

const TRUNCATE_AT = 80;
const ELLIPSIS = '\u2026'; // …
const EMPTY_VALUE = '\u2014'; // —

interface FormattedField {
  /** Text to render in the row's value slot. May be truncated. */
  readonly display: string;
  /** Untruncated text — pass to a `title` attr if it differs from `display`. */
  readonly full: string;
}

function formatField(
  view: FieldConfidenceView<unknown>,
  options: { debug: boolean },
): FormattedField {
  const raw = stringifyValue(view.value);
  if (raw.length === 0) {
    return { display: EMPTY_VALUE, full: EMPTY_VALUE };
  }

  const echoed = options.debug ? `${raw} \u00B7 ${view.sourceLabel}` : raw;

  if (echoed.length <= TRUNCATE_AT) {
    return { display: echoed, full: echoed };
  }

  // Truncate to TRUNCATE_AT - 1 so the appended ellipsis keeps the visible
  // length <= TRUNCATE_AT. Always retain `echoed` (with debug suffix) as the
  // full text so the title attr matches what would have been shown.
  return {
    display: echoed.slice(0, TRUNCATE_AT - 1) + ELLIPSIS,
    full: echoed,
  };
}

/**
 * Pure value-to-string coercion for arbitrary `unknown` payloads.
 *
 * Returns the empty string for null/undefined/NaN-Date so `formatField` can
 * collapse them to the canonical EMPTY_VALUE — keeps the "is this empty?"
 * decision in one place.
 */
function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter((entry) => entry.length > 0).join(', ');
  }
  if (typeof value === 'object') {
    // Last resort. Any field reaching this branch is a smell — wrap your
    // domain types in a typed projection upstream rather than leaning on
    // JSON.stringify in the renderer.
    try {
      return JSON.stringify(value);
    } catch {
      return '[unserializable]';
    }
  }
  return String(value);
}
