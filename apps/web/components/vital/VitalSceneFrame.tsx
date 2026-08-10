import * as React from 'react';

/**
 * VitalSceneFrame — the dark public scene register as a container (D-02).
 *
 * Warm graphite canvas, scene text ink, and at most ONE indigo atmospheric
 * glow — behind the frame's content only, never behind a button, control,
 * input, or source status (the visual-language color law). The glow paints
 * through a ::before-equivalent absolutely-positioned layer under the
 * children in DOM order, so the island no-z-index discipline holds.
 *
 * One glow per viewport is a composition rule this component can only help
 * with, not prove — the harness and design review own the count.
 */
export type VitalSceneFrameProps = {
  children: React.ReactNode;
  /** Paint the single indigo atmosphere behind this frame's content. */
  glow?: boolean;
  as?: 'div' | 'section';
  className?: string;
  'aria-label'?: string;
};

export function VitalSceneFrame({
  children,
  glow = false,
  as: Tag = 'div',
  className,
  'aria-label': ariaLabel,
}: VitalSceneFrameProps) {
  return (
    <Tag
      aria-label={ariaLabel}
      className={
        'relative bg-[var(--vt-scene-canvas)] text-[var(--vt-scene-text)] ' + `${className ?? ''}`
      }
    >
      {glow ? (
        <span
          aria-hidden="true"
          data-vital-scene-glow=""
          className="pointer-events-none absolute inset-[-12%_-6%_18%] bg-[image:var(--vt-scene-glow)]"
        />
      ) : null}
      {children}
    </Tag>
  );
}
