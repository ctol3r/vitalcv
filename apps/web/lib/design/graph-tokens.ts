import type { Transition } from 'framer-motion';

export const GraphTokens = {
  colors: {
    node: {
      clinician: '#f59e0b', // Amber/Gold - Center of gravity
      issuer: '#3b82f6',    // Blue - Institutional weight
      credential: '#10b981', // Emerald - Verified status
      employer: '#8b5cf6',   // Violet - Destination/Consumer
      decision: '#f8fafc',   // Slate/White - Final outcome
    },
    edge: {
      base: '#475569',       // Slate - Subdued
      highlighted: 'rgba(255, 255, 255, 0.5)',
      ISSUED_BY: '#3b82f6',
      VERIFIED_BY: '#10b981',
      DEPENDS_ON: '#f59e0b',
      ACCEPTED_BY: '#8b5cf6',
    },
    background: '#020617', // Slate 950
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
      smooth: { type: 'tween', duration: 0.6, ease: 'easeInOut' } as Transition,
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
