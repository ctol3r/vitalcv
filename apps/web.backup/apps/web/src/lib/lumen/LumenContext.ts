/**
 * LumenContext
 * Global environment object for LUMEN system state
 */

import { createContext, useContext } from 'react';
import type {
  LumenStateSnapshot,
  LumenContextConfig,
  LumenPhysicsConfig,
  LumenColorSpectrum,
  RoleType,
} from './types';

export interface LumenContextValue {
  snapshot: LumenStateSnapshot | null;
  config: LumenContextConfig;
  updateSnapshot: (snapshot: LumenStateSnapshot) => void;
  updateConfig: (config: Partial<LumenContextConfig>) => void;
}

const defaultPhysics: LumenPhysicsConfig = {
  gravity: 0.5,
  elasticity: 0.7,
  pulseStrength: 0.6,
  friction: 0.3,
  airResistance: 0.2,
};

const defaultColors: LumenColorSpectrum = {
  emerald: '#10b981', // emerald-500
  anchorBlue: '#3b82f6', // blue-500
  riskAmber: '#f59e0b', // amber-500
  veilPurple: '#a78bfa', // violet-400
  complianceGray: '#6b7280', // gray-500
};

const defaultConfig: LumenContextConfig = {
  role: 'Clinician',
  physics: defaultPhysics,
  colorSpectrum: defaultColors,
  reducedMotion: false,
  batteryMode: 'normal',
};

export const LumenContext = createContext<LumenContextValue | null>(null);

export function useLumenContext(): LumenContextValue {
  const context = useContext(LumenContext);
  if (!context) {
    throw new Error('useLumenContext must be used within LumenProvider');
  }
  return context;
}

