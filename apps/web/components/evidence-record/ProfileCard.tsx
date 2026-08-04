/**
 * The reusable clinician profile — THE persistent object of the homepage
 * story. One definition, rendered by the hero pathway, the MATCHA discover
 * chapter and the apply/handoff chapter, so the visitor is following one
 * clinician and one record through the system rather than a collection of
 * unrelated cards.
 *
 * Pure and server-renderable. `lit` distinguishes the resolved profile from
 * the dormant "ready to become a profile" silhouette: dashed identity mark,
 * name-shaped bars, six hollow evidence lanes — never an empty box.
 *
 * The profile is fictional (Z0 data rule) and every surface that shows it
 * resolved carries an illustrative label.
 */

export const PROFILE = {
  monogram: 'KO',
  name: 'K. Osei, PA-C',
  meta: 'Emergency medicine · 8 years',
  lanesFilled: 4,
  lanesTotal: 6,
} as const;

interface Props {
  lit: boolean;
  /** Top-right chip; defaults to the object's own name. */
  badge?: string;
  /** Extra class for composition (never restyles the internals). */
  className?: string;
}

export function ProfileCard({ lit, badge, className }: Props) {
  return (
    <div className={`z1-node z1-profile${className ? ` ${className}` : ''}`} data-on={lit ? '' : undefined}>
      <div className="z1-profile-head">
        <span className="z1-avatar" aria-hidden="true">{lit ? PROFILE.monogram : ''}</span>
        <div className="z1-profile-id">
          {lit ? (
            <>
              <p className="z1-profile-name">{PROFILE.name}</p>
              <p className="z1-profile-meta">{PROFILE.meta}</p>
            </>
          ) : (
            <>
              <span className="z1-sil z1-sil--name" />
              <span className="z1-sil z1-sil--meta" />
            </>
          )}
        </div>
        <span className="z1-profile-badge">{badge ?? (lit ? 'Reusable profile' : 'Your profile')}</span>
      </div>
      <div
        className="z1-lanes"
        role="img"
        aria-label={lit
          ? `Evidence: ${PROFILE.lanesFilled} of ${PROFILE.lanesTotal} sources answered`
          : 'Six evidence lanes, none read yet'}
      >
        {Array.from({ length: PROFILE.lanesTotal }, (_, i) => (
          <span key={i} className="z1-lane" data-f={lit && i < PROFILE.lanesFilled ? '' : undefined} />
        ))}
      </div>
      <p className="z1-profile-evidence">
        {lit
          ? `Evidence record attached · ${PROFILE.lanesFilled} of ${PROFILE.lanesTotal} sources answered · Illustrative — not a live result`
          : 'Six evidence lanes · filled as sources answer'}
      </p>
    </div>
  );
}
