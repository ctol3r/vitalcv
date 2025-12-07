/**
 * React hook for UsabilityEngine
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getUsabilityEngine, type UsabilitySettings, type IdentityHint, type AppState } from '@/lib/usability/usability-engine';
import { useSession } from '@/contexts/SessionContext';

export function useUsability() {
  const engine = getUsabilityEngine();
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const [settings, setSettings] = useState<UsabilitySettings>(engine.getSettings());
  const [identityHint, setIdentityHint] = useState<IdentityHint | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  // Auto-detect identity on mount
  useEffect(() => {
    if (settings.autoDetectIdentity && !session?.npi) {
      setIsDetecting(true);
      engine
        .detectIdentity()
        .then((hint) => {
          setIdentityHint(hint);
          if (hint && settings.oneTapMode) {
            // Auto-claim if one-tap mode is enabled
            engine.autoClaimNPI(hint.npi || '').catch(console.warn);
          }
        })
        .finally(() => setIsDetecting(false));
    }
  }, [settings.autoDetectIdentity, settings.oneTapMode, session?.npi]);

  // Auto-restore last state
  useEffect(() => {
    if (settings.autoRestoreState && engine.shouldRestoreState()) {
      const state = engine.getState();
      if (state?.lastRoute && state.lastRoute !== pathname) {
        // Only restore if we're on a default route
        if (pathname === '/' || pathname === '/dashboard') {
          router.push(state.lastRoute);
        }
      }
    }
  }, [settings.autoRestoreState, pathname, router]);

  // Save state on route change
  useEffect(() => {
    if (settings.autoRestoreState && pathname) {
      engine.saveState({
        lastRoute: pathname,
        lastContext: {
          timestamp: Date.now(),
        },
      });
    }
  }, [pathname, settings.autoRestoreState]);

  const updateSettings = useCallback(
    (updates: Partial<UsabilitySettings>) => {
      engine.updateSettings(updates);
      setSettings(engine.getSettings());
    },
    [engine],
  );

  const refreshEverything = useCallback(async () => {
    await engine.refreshEverything();
  }, [engine]);

  return {
    settings,
    updateSettings,
    identityHint,
    isDetecting,
    refreshEverything,
    engine,
  };
}






