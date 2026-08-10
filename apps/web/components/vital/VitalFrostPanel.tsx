import * as React from 'react';

/**
 * VitalFrostPanel — the one frosted material (D-02).
 *
 * Translucent panel over the scene register: frost fill, warm hairline,
 * backdrop blur, panel radius (decision 4: 24px). Elevation comes from
 * material and edge — never a drop shadow (LINT-06). Frost is CHROME, never
 * evidence: nothing inside a frost panel may be the only rendering of a
 * state (EC-4); it houses composition, not truth.
 *
 * Frosting only reads as material over something worth blurring — pair it
 * with VitalSceneFrame's glow, which is why the homepage work surface was its
 * first consumer.
 */
export type VitalFrostPanelProps = {
  children: React.ReactNode;
  /** Semantic wrapper element. */
  as?: 'div' | 'section' | 'figure' | 'aside';
  className?: string;
  'aria-label'?: string;
};

export function VitalFrostPanel({
  children,
  as: Tag = 'div',
  className,
  'aria-label': ariaLabel,
}: VitalFrostPanelProps) {
  return (
    <Tag
      aria-label={ariaLabel}
      className={
        'relative min-w-0 overflow-hidden rounded-[var(--vt-shape-panel)] ' +
        'border border-[var(--vt-frost-border)] bg-[var(--vt-frost-bg)] ' +
        'backdrop-blur-[14px] ' +
        `${className ?? ''}`
      }
    >
      {children}
    </Tag>
  );
}
