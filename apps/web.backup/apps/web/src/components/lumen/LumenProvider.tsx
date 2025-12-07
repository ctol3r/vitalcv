/**
 * LumenProvider
 * React context provider for LUMEN system
 */

'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  LumenContext,
  useLumenContext,
  type LumenContextConfig,
  type LumenStateSnapshot,
} from '@/lib/lumen';
import { getLumenEngine } from '@/lib/lumen/LumenEngine';

interface LumenProviderProps {
  children: ReactNode;
  initialConfig?: Partial<LumenContextConfig>;
  initialSnapshot?: LumenStateSnapshot;
}

export function LumenProvider({
  children,
  initialConfig,
  initialSnapshot,
}: LumenProviderProps) {
  const [snapshot, setSnapshot] = useState<LumenStateSnapshot | null>(initialSnapshot ?? null);
  const [config, setConfig] = useState<LumenContextConfig>(() => {
    const engine = getLumenEngine(initialConfig);
    return engine.getConfig();
  });

  // Initialize engine
  const engine = useMemo(() => getLumenEngine(initialConfig), [initialConfig]);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateReducedMotion = () => {
      setConfig((prev) => ({
        ...prev,
        reducedMotion: mediaQuery.matches,
      }));
      engine.updateConfig({ reducedMotion: mediaQuery.matches });
    };

    updateReducedMotion();
    mediaQuery.addEventListener('change', updateReducedMotion);
    return () => mediaQuery.removeEventListener('change', updateReducedMotion);
  }, [engine]);

  const updateSnapshot = (newSnapshot: LumenStateSnapshot) => {
    setSnapshot(newSnapshot);
    engine.updateSnapshot(newSnapshot);
  };

  const updateConfig = (updates: Partial<LumenContextConfig>) => {
    setConfig((prev) => {
      const updated = { ...prev, ...updates };
      engine.updateConfig(updates);
      return updated;
    });
  };

  const value = useMemo(
    () => ({
      snapshot,
      config,
      updateSnapshot,
      updateConfig,
    }),
    [snapshot, config]
  );

  return <LumenContext.Provider value={value}>{children}</LumenContext.Provider>;
}

export { useLumenContext };

