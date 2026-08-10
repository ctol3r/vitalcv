import * as React from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import type { CanonicalSourceCoverageState } from '@vitalcv/trust-state';

/**
 * ProvenanceChip — the canonical *provenance-carrying* status atom.
 *
 * Where {@link TruthStateChip} answers "how should a viewer interpret this
 * visible state" (and deliberately keeps the timestamp screen-reader-only,
 * because the *row* surfaces provenance), ProvenanceChip is the atom for
 * surfaces where the chip must carry its own evidence: a dot, an
 * operator-honest word, and a **visible** mono `source · timestamp` line
 * underneath. Every rendered status therefore states where it came from and
 * when — the truth-contract rule ("provenance always visible") expressed as
 * a single component.
 *
 * It is anchored to the canonical source-coverage vocabulary
 * ({@link CanonicalSourceCoverageState} from `@vitalcv/trust-state`) so the
 * fragmented per-surface status enums can migrate onto one word list, plus
 * two states the canonical set does not model as coverage:
 *   - `revoked`      — a first-class **fail-closed** register (the only red).
 *   - `selfAttested` — the dashed band that can never read as source-checked.
 *
 * Copy rule (enforced by provenance-chip.test.tsx): no bare "Verified", no
 * banned CLAUDE.md phrases. Only `checked` earns the word "Checked".
 */

/** The full ProvenanceChip vocabulary: canonical coverage states + the two
 *  presentation-only states the coverage model does not carry. */
export type ProvenanceState =
  | CanonicalSourceCoverageState
  | 'revoked'
  | 'selfAttested';

/**
 * Visual registers. Each maps a group of states to one treatment so the
 * six-family design (checked / gated / stale / unknown / review / revoked,
 * plus the self-attested band) reads consistently. `revoked` owns red.
 */
type ProvenanceRegister =
  | 'checked'
  | 'aging'
  | 'gated'
  | 'review'
  | 'unknown'
  | 'preview'
  | 'revoked'
  | 'selfAttested';

/** Dot shape encodes the register beyond color alone (color is never the
 *  sole signal): filled = active, hollow = absence, diamond = fail-closed. */
type DotShape = 'filled' | 'hollow' | 'diamond';

interface ProvenanceMeta {
  /** Visible chip label. NEVER the bare word "Verified". */
  label: string;
  /** Legend sentence — plain operator language, banned-string-safe. */
  description: string;
  register: ProvenanceRegister;
  dot: DotShape;
  /**
   * May this state be drawn with an affirmative (check) glyph?
   *
   * LINT-07: the check is reserved for states where a source actually backed
   * the fact. A gated, review, unavailable, not-found, revoked, or
   * self-attested state carrying a check is the system's cardinal sin.
   *
   * This mirrors `EVIDENCE_STATE[...].affirmative` in `lib/vital/evidenceState`
   * so LINT-07 can cover both chips off one flag while StateChip is retired
   * into this component (UX-02). Only `checked` is affirmative — `notFound` is
   * deliberately NOT, because the source answering "no record" is a finding,
   * never a confirmation.
   */
  affirmative: boolean;
  /** True only for `revoked`: content blocks, custody history stays visible. */
  failClosed?: boolean;
}

/**
 * W1082, ported from `components/vital/StateChip` (UX-02 Step 1). That component
 * was deleted in Step 4 — this is now the only attributed chip.
 *
 * The chip is ATTRIBUTED, and attribution is required at the type level. A
 * state word without "who answered, and when" is exactly how `checked` got
 * conflated with affirmation, so a call site can no longer forget attribution —
 * it can only state explicitly which kind it has:
 *
 *  - `{ source, asOf }` — a source or check answered. `asOf: null` is
 *    first-class: it renders and announces "as-of not recorded" rather than
 *    pretending a timestamp exists. The qualifier lives INSIDE the value, so no
 *    consumer can strip it in a copy pass.
 *  - `{ declared }` — nobody was queried; the state names its own actor
 *    (self-attested → the holder). The caller must say who, in words.
 *  - `{ legend: true, ... }` — the chip illustrates the vocabulary itself, or
 *    renders demo/illustrative lane data. Announced as an example so it is
 *    impossible to mistake for a real result about a real person.
 *
 * Before this contract, `source` and `timestamp` were optional and six mounted
 * call sites rendered a bare state word with no attribution at all.
 */
export type ProvenanceAttribution =
  | {
      /** Which source or check answered (e.g. "NPPES", "OIG LEIE"). */
      source: string;
      /** ISO instant, honest relative phrase, or null → "as-of not recorded". */
      asOf: string | null;
      /**
       * Machine ISO instant, for when `asOf` is human-formatted prose
       * ("Jul 15, 2026"). Keeps `<time datetime>` machine-readable. Omit when
       * `asOf` is already ISO.
       */
      asOfISO?: string;
      /** Extra mono note appended after the as-of (e.g. "no match"). */
      detail?: string;
      legend?: never;
      declared?: never;
    }
  | {
      /** Who declared it, in words (e.g. "entered by holder"). */
      declared: string;
      source?: never;
      legend?: never;
    }
  | {
      /** Illustrative only — a vocabulary example or demo data. */
      legend: true;
      /** Optional illustrative provenance, rendered but announced as an example. */
      source?: string;
      asOf?: string | null;
      detail?: string;
      declared?: never;
    };

export const PROVENANCE_META: Record<ProvenanceState, ProvenanceMeta> = {
  checked: {
    label: 'Checked',
    description: 'A source returned a usable payload for this fact. The only state that earns the word.',
    register: 'checked',
    // The ONLY affirmative state in the vocabulary (LINT-07).
    affirmative: true,
    dot: 'filled',
  },
  stale: {
    label: 'Stale',
    description: 'Was checked once; aged past its freshness window. A refresh is one request away.',
    register: 'aging',
    affirmative: false,
    dot: 'filled',
  },
  pending: {
    label: 'Pending',
    description: 'A check is in progress or queued. No claim is made yet.',
    register: 'aging',
    affirmative: false,
    dot: 'hollow',
  },
  gated: {
    label: 'Gated',
    description: 'The source is reachable but blocked behind an agreement or authorization. Honest, not hidden.',
    register: 'gated',
    affirmative: false,
    dot: 'filled',
  },
  accessRequired: {
    label: 'Access required',
    description: 'Authorization is needed before this source can be read. Caller action expected.',
    register: 'gated',
    affirmative: false,
    dot: 'filled',
  },
  reviewRequired: {
    label: 'Review required',
    description: 'A human review is needed before this can advance. Routed, not decided.',
    register: 'review',
    affirmative: false,
    dot: 'filled',
  },
  unavailable: {
    label: 'Unavailable',
    description: 'The source did not return a payload on this attempt. A system condition, not a finding.',
    register: 'unknown',
    affirmative: false,
    dot: 'hollow',
  },
  notFound: {
    label: 'No active record',
    // Deliberately the mirror of `unavailable` above: there the source gave us
    // nothing, here the source gave us an answer and the answer was no.
    description: 'The source answered and holds no active record for this subject. A finding, not a system condition — and never a confirmation.',
    register: 'unknown',
    affirmative: false,
    dot: 'hollow',
  },
  notDecisionGrade: {
    label: 'Not decision-grade',
    description: 'Present but not sufficient to decide on. Treated as absence for any decision.',
    register: 'unknown',
    affirmative: false,
    dot: 'hollow',
  },
  previewOnly: {
    label: 'Preview',
    description: 'Synthetic or preview payload for demonstration. Never a real source confirmation.',
    register: 'preview',
    affirmative: false,
    dot: 'filled',
  },
  revoked: {
    label: 'Revoked',
    description: 'Withdrawn at the source and failed closed — content blocks; the custody history stays visible.',
    register: 'revoked',
    affirmative: false,
    dot: 'diamond',
    failClosed: true,
  },
  selfAttested: {
    label: 'Self-attested',
    description: 'Entered by the holder and unverified. Rendered apart so it can never read as source-checked.',
    register: 'selfAttested',
    affirmative: false,
    dot: 'hollow',
  },
};

/**
 * Register → token treatment. `revoked` is driven off `--vt-severity-critical`
 * directly (not `--vt-badge-critical-*`, which is aliased to neutral in the
 * base token layer) so the fail-closed red is guaranteed and reserved.
 */
const chipVariants = cva(
  [
    'inline-flex items-center gap-1.5 w-fit',
    'border',
    'px-[var(--vt-space-8,8px)] py-[var(--vt-space-2,2px)]',
    'text-[11px] leading-[var(--vt-line-tight,1.15)]',
    'font-[var(--vt-font-weight-semibold,600)] uppercase tracking-[0.1em]',
    'whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      /**
       * Geometry. CD-10 makes radius semantic and retires the pill outright:
       * "State stamps are 3px rectangles. A record carries stamps, not pills."
       *
       * `stamp` is therefore the doctrinally correct shape, and the homepage
       * ships it. `pill` remains the DEFAULT only because five other mounted
       * surfaces (`/verify/[npi]`, `/evidence-network`, `/status/technical`,
       * `/trust/attribution`, `/passport`) currently render the old geometry,
       * and silently restyling them inside a homepage change would put pixels
       * in front of users that no one reviewed. Migrating them is CD-W3 work,
       * and when the last caller moves, this variant collapses to `stamp`.
       */
      shape: {
        pill: 'rounded-[var(--vt-radius-pill,9999px)]',
        stamp: 'rounded-[3px]',
      },
      register: {
        checked: 'border-transparent bg-[var(--vt-badge-checked-bg)] text-[var(--vt-badge-checked-text)]',
        aging: 'border-transparent bg-[var(--vt-badge-pending-bg)] text-[var(--vt-badge-pending-text)]',
        gated: 'border-transparent bg-[var(--vt-badge-access-bg)] text-[var(--vt-badge-access-text)]',
        review: 'border-[var(--vt-badge-warning-border,transparent)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
        /**
         * ABSENCE, not severity. `unknown` covers `unavailable` (the source
         * returned nothing), `notFound` (it answered, and the answer was no),
         * and `notDecisionGrade` (present but insufficient). None of the three
         * is a severity finding, and this file's own header reserves red for
         * `revoked` alone — "a first-class fail-closed register (the only red)".
         *
         * It used to paint `--vt-badge-unavailable-*`, which is a RED family,
         * so all three rendered red and contradicted both that sentence and
         * `unavailable`'s own description ("A system condition, not a
         * finding"). The reserved-red guard missed it because it string-matched
         * `--vt-severity-critical` — a different token that is also red — so
         * the rule passed while three states broke it.
         *
         * Neutral is the honest register. `unknown` and `gated` therefore share
         * a hue; they stay distinguishable by dot shape (hollow vs filled) and
         * by their words, which is what EC-4 requires anyway — meaning is never
         * carried by colour alone.
         */
        unknown: 'border-transparent bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
        preview: 'border-transparent bg-[var(--vt-badge-preview-bg)] text-[var(--vt-badge-preview-text)]',
        revoked:
          'border-[color-mix(in_oklab,var(--vt-severity-critical)_50%,transparent)] bg-[color-mix(in_oklab,var(--vt-severity-critical)_12%,transparent)] text-[var(--vt-severity-critical)] font-[var(--vt-font-weight-bold,700)]',
        selfAttested: 'border-dashed border-[var(--vt-border,currentColor)] bg-transparent text-[var(--vt-text-secondary)]',
      },
      size: {
        sm: 'px-[var(--vt-space-6,6px)] py-[1px] text-[10px] tracking-[0.12em]',
        md: '',
      },
    },
    defaultVariants: { register: 'unknown', size: 'md', shape: 'pill' },
  },
);

function Dot({ shape }: { shape: DotShape }) {
  if (shape === 'diamond') {
    return (
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rotate-45 rounded-[1px] bg-current"
      />
    );
  }
  if (shape === 'hollow') {
    return (
      <span
        aria-hidden="true"
        className="h-[7px] w-[7px] rounded-full border-[1.5px] border-current bg-transparent"
      />
    );
  }
  return <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-current" />;
}

/**
 * Normalize an ISO instant to a compact, locale-independent UTC display
 * (`2026-07-14 09:12Z`). Non-ISO strings pass through unchanged so callers
 * can supply a relative phrase ("214d ago") when that is the honest value.
 */
export function formatProvenanceTimestamp(value: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return m ? `${m[1]} ${m[2]}Z` : value;
}

/** The literal words rendered (and announced) when a source answered but the
 *  as-of was not recorded. Never a silent omission, never an invented time. */
export const AS_OF_NOT_RECORDED = 'as-of not recorded';

export interface ProvenanceChipProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'aria-label'> {
  /** The provenance state to display. */
  state: ProvenanceState;
  /**
   * Who answered, and when — REQUIRED (W1082). There is no way to render a
   * state word without stating its attribution; see {@link ProvenanceAttribution}.
   */
  attribution: ProvenanceAttribution;
  /** Override the visible label (caller owns banned-strings review). */
  label?: string;
  size?: 'sm' | 'md';
  /** Geometry. `stamp` is CD-10's 3px rectangle; see `chipVariants`. */
  shape?: 'pill' | 'stamp';
  /**
   * Whether the chip PAINTS its provenance line. Never whether it STATES its
   * attribution — `attribution` is required either way and always reaches
   * assistive tech through the accessible name.
   *
   * `'hidden'` exists for rows that already paint the provenance themselves
   * (the EvidenceCapsule row, EvidenceRow's adjacent mono line). Without it a
   * caller would have to choose between duplicating the line visually and
   * dropping the attribution entirely — and the old optional `source`/
   * `timestamp` props made the second option the easy one. This is the
   * layout escape hatch; there is no truth escape hatch.
   */
  provenanceLine?: 'auto' | 'hidden';
}

/**
 * The canonical provenance-carrying status chip: dot + word + a visible mono
 * `source · timestamp` line. Pure/SSR-safe.
 */
export function ProvenanceChip({
  state,
  attribution,
  label,
  size,
  shape,
  provenanceLine = 'auto',
  className,
  ...rest
}: ProvenanceChipProps) {
  const meta = PROVENANCE_META[state];
  const visibleLabel = label ?? meta.label;

  const isLegend = 'legend' in attribution && attribution.legend === true;
  const isDeclared = 'declared' in attribution && attribution.declared !== undefined;

  const source = isDeclared ? undefined : attribution.source;
  const asOf = isDeclared ? undefined : attribution.asOf;
  // The `declared` form is ANNOUNCED but not PAINTED: it names an actor, not a
  // source that answered, so there is no provenance line to draw. It still
  // reaches assistive tech through `ariaLabel` below — the same split
  // StateChip uses, and what lets a tight inline row adopt the contract
  // without gaining a second line of text.
  const detail = isDeclared ? undefined : attribution.detail;
  const asOfISO = isDeclared || isLegend ? undefined : attribution.asOfISO;

  // `asOf: null` is a statement, not an absence: it renders the words. Only an
  // omitted key (legend form) yields no time node at all.
  const ts = asOf ? formatProvenanceTimestamp(asOf) : asOf === null ? AS_OF_NOT_RECORDED : undefined;

  const provNodes: React.ReactNode[] = [];
  if (source) provNodes.push(<span key="s" className="text-[var(--vt-text-secondary)]">{source}</span>);
  if (ts) {
    provNodes.push(
      asOf ? (
        <time key="t" dateTime={asOfISO ?? asOf}>{ts}</time>
      ) : (
        <span key="t">{ts}</span>
      ),
    );
  }
  if (detail) provNodes.push(<span key="d">{detail}</span>);
  const hasProvenance = provenanceLine !== 'hidden' && provNodes.length > 0;

  const ariaLabel = [
    visibleLabel,
    isLegend ? 'vocabulary example, not a result about anyone' : null,
    source ? `source ${source}` : null,
    ts ?? null,
    isDeclared ? attribution.declared : null,
    meta.failClosed ? 'fail closed' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      data-provenance-state={state}
      data-attribution={isLegend ? 'legend' : isDeclared ? 'declared' : 'source'}
      data-fail-closed={meta.failClosed ? 'true' : undefined}
      className={cn('inline-flex flex-col items-start gap-1', className)}
      {...rest}
    >
      <span className={cn(chipVariants({ register: meta.register, size, shape }))}>
        <Dot shape={meta.dot} />
        <span>{visibleLabel}</span>
      </span>
      {hasProvenance && (
        <span className="font-mono text-[10.5px] leading-tight text-[var(--vt-text-muted,var(--vt-text-secondary))] tabular-nums">
          {provNodes.map((node, i) => (
            <React.Fragment key={i}>
              {i > 0 && ' · '}
              {node}
            </React.Fragment>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * Every state in a legend/story-friendly order: decision-grade first, the
 * fail-closed and self-attested registers last so the reader ends on the two
 * states that must never be mistaken for a check.
 */
export const PROVENANCE_ORDER: ReadonlyArray<ProvenanceState> = Object.freeze([
  'checked',
  'gated',
  'accessRequired',
  'stale',
  'pending',
  'reviewRequired',
  'unavailable',
  'notFound',
  'notDecisionGrade',
  'previewOnly',
  'revoked',
  'selfAttested',
] as const);

/** The compact six-register set most surfaces show (the field-guide atom):
 *  checked · gated · stale · unavailable · revoked · self-attested. */
export const PROVENANCE_CORE_ORDER: ReadonlyArray<ProvenanceState> = Object.freeze([
  'checked',
  'gated',
  'stale',
  'unavailable',
  'revoked',
  'selfAttested',
] as const);
