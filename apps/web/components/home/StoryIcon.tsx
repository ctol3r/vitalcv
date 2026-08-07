import * as React from 'react';

/**
 * StoryIcon — bespoke, animated line icons that help TELL the story (Chris,
 * 2026-07-18: "bigger and better animated icons"). Each icon animates to convey
 * its product stage: the identity scan sweeps, MATCHA's radar rotates, the proof
 * packet flies, Recognition's ring draws. Pure inline SVG (currentColor + a
 * signal accent), animated by scoped CSS in homepage-motion.css. Every icon's
 * resting state is complete and legible, so `prefers-reduced-motion` (which
 * pauses all of it) still shows a finished icon. Decorative — always aria-hidden.
 */

export type StoryIconName =
  | 'identity'
  | 'readiness'
  | 'match'
  | 'apply'
  | 'recognition'
  | 'reuse'
  | 'wallet';

const EM = 'var(--vt-state-source-confirmed)';
const AC = 'var(--accent)';
const OP = 'var(--vt-field-opportunity, #2f6fb0)';

export function StoryIcon({ name, size = 40 }: { name: StoryIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className: `aicon aicon-${name}`,
  };

  switch (name) {
    case 'identity': // fingerprint ridges + a sweeping scan line
      return (
        <svg {...common}>
          <path d="M16 20a8 8 0 0 1 16 0v4" opacity="0.9" />
          <path d="M20 21a4 4 0 0 1 8 0v6" opacity="0.7" />
          <path d="M13 24a11 11 0 0 1 22 0v3" opacity="0.5" />
          <path d="M24 24v8" opacity="0.9" />
          <line className="aicon-scan" x1="12" y1="24" x2="36" y2="24" stroke={AC} strokeWidth="2.5" />
        </svg>
      );
    case 'readiness': // shield with a check that draws in
      return (
        <svg {...common}>
          <path d="M24 6 10 12v9c0 8 6 14 14 17 8-3 14-9 14-17v-9L24 6Z" opacity="0.85" />
          <path className="aicon-draw" d="M18 24l4.5 4.5L31 20" stroke={EM} strokeWidth="2.75" pathLength={1} />
        </svg>
      );
    case 'match': // radar target with a rotating sweep + target dot
      return (
        <svg {...common}>
          <circle cx="24" cy="24" r="14" opacity="0.55" />
          <circle cx="24" cy="24" r="8" opacity="0.4" />
          <g className="aicon-radar" style={{ transformOrigin: '24px 24px' }}>
            <line x1="24" y1="24" x2="24" y2="10" stroke={AC} strokeWidth="2.5" />
          </g>
          <circle className="aicon-blip" cx="31" cy="18" r="2.4" fill={EM} stroke="none" />
        </svg>
      );
    case 'apply': // proof packet flying like a paper plane, with a trail
      return (
        <svg {...common}>
          <path className="aicon-trail" d="M6 30c6-1 10 1 14-3" stroke={OP} strokeWidth="1.75" opacity="0.6" strokeDasharray="2 4" />
          <g className="aicon-fly">
            <path d="M40 8 20 20l6 4 2 8 4-6 8-18Z" opacity="0.9" />
            <path d="M40 8 28 26" opacity="0.6" />
          </g>
        </svg>
      );
    case 'recognition': // acceptance ring drawing + check + sparkles
      return (
        <svg {...common}>
          <circle className="aicon-ring" cx="24" cy="22" r="12" stroke={OP} strokeWidth="2.5" pathLength={1} />
          <path className="aicon-draw" d="M18 22l4.5 4.5L30 18" stroke={EM} strokeWidth="2.75" pathLength={1} />
          <path d="M24 34v6M20 38h8" opacity="0.7" />
          <g className="aicon-spark" stroke={AC}>
            <path d="M37 12v4M35 14h4" strokeWidth="2" />
          </g>
        </svg>
      );
    case 'reuse': // two arrows cycling — nothing resets
      return (
        <svg {...common}>
          <g className="aicon-cycle" style={{ transformOrigin: '24px 24px' }}>
            <path d="M12 20a12 12 0 0 1 20-5" />
            <path d="M32 9v6h-6" stroke={EM} />
            <path d="M36 28a12 12 0 0 1-20 5" />
            <path d="M16 39v-6h6" stroke={AC} />
          </g>
        </svg>
      );
    case 'wallet': // a card sliding up into the wallet
      return (
        <svg {...common}>
          <rect x="9" y="16" width="30" height="20" rx="3" opacity="0.9" />
          <path d="M9 22h30" opacity="0.5" />
          <rect className="aicon-card" x="15" y="10" width="18" height="12" rx="2" fill="var(--vt-surface)" stroke={EM} strokeWidth="2" />
          <circle cx="33" cy="28" r="2" fill={AC} stroke="none" />
        </svg>
      );
  }
}

export default StoryIcon;
