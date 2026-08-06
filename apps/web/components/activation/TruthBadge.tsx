'use client';

/**
 * The origin badge on a profile value — Wave 1076 B1.
 *
 * One rule: this component may never render a bare "Verified", and it may never
 * render the same badge for two different truth classes. "Found in NPPES" and
 * "Added or changed by you" have to look different at a glance, because the
 * difference between them is the difference between a public registry's answer
 * and a person's own statement.
 *
 * The two are also styled differently on purpose rather than by accident of
 * theme: public-source values read as neutral facts, clinician-provided values
 * read as attributed. Neither is styled as an approval — no green, no check
 * mark, no seal.
 */

import { cn } from '@/lib/utils';
import type { TruthClass } from '@/lib/activation/profileView';
import { truthLabel } from '@/lib/activation/truthLabels';

/*
 * Light-first, with a dark override.
 *
 * These were written dark-only (`text-sky-200` on a translucent tint), which
 * renders as pale-blue-on-pale-blue in the default light theme — the badge was
 * legible in a screenshot only if you already knew what it said. A label nobody
 * can read is the same as no label, and this is the label that says whether a
 * value came from a registry or from the clinician.
 */
const TONE: Record<TruthClass, string> = {
  public_source: 'border-sky-600/30 bg-sky-500/10 text-sky-800 dark:text-sky-200',
  clinician_provided: 'border-amber-600/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  ownership_verified: 'border-violet-600/30 bg-violet-500/10 text-violet-800 dark:text-violet-200',
  employer_reviewed: 'border-slate-600/30 bg-slate-500/10 text-slate-800 dark:text-slate-200',
};

export function TruthBadge({
  truthClass,
  source,
  className,
}: {
  truthClass: TruthClass;
  source?: string;
  className?: string;
}) {
  const { label, meaning } = truthLabel(truthClass, source);
  return (
    <span
      data-truth-class={truthClass}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE[truthClass],
        className,
      )}
      // The meaning is on the badge itself, so a screen reader hears what the
      // label means rather than just its two words.
      title={meaning}
    >
      {label}
    </span>
  );
}
