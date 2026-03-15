import type { Transition } from 'framer-motion';
import { motionTransitions } from '@/ui/animation/motion';
import { themeTokens } from '@/ui/theme/tokens';

export const GraphTokens = {
  colors: {
    node: {
      clinician: themeTokens.colors.dark.accentYellow,
      issuer: themeTokens.colors.dark.accentBlue,
      credential: themeTokens.colors.dark.success,
      employer: themeTokens.colors.dark.accentMagenta,
      decision: themeTokens.colors.dark.textPrimary,
    },
    edge: {
      base: themeTokens.colors.dark.borderPrimary,
      highlighted: 'rgba(255, 255, 255, 0.52)',
      ISSUED_BY: themeTokens.colors.dark.accentBlue,
      VERIFIED_BY: themeTokens.colors.dark.success,
      DEPENDS_ON: themeTokens.colors.dark.accentYellow,
      ACCEPTED_BY: themeTokens.colors.dark.accentMagenta,
    },
    background: themeTokens.colors.dark.backgroundPrimary,
  },
  typography: {
    micro: 'text-[10px] uppercase tracking-widest font-bold',
    standard: 'text-sm font-medium',
    mono: 'text-[11px] font-mono break-all',
  },
  motion: {
    spring: {
      bouncy: { type: 'spring', stiffness: 300, damping: 20 } as Transition,
      gentle: { type: 'spring', stiffness: 200, damping: 25 } as Transition,
      stiff: { type: 'spring', stiffness: 400, damping: 30 } as Transition,
    },
    tween: {
      smooth: { type: 'tween', ...motionTransitions.panel } as Transition,
      packet: { duration: 2, ease: 'linear', repeat: Infinity, times: [0, 0.5, 0.6, 1] } as Transition,
    },
  },
  sizes: {
    nodeRadius: {
      center: 32,
      group: 28,
      credential: 16,
    },
  },
};
