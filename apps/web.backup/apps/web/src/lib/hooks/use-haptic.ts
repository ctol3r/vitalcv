/**
 * Haptic Feedback Hook
 */

import { useCallback } from 'react';
import { triggerHapticFeedback } from '@/lib/haptic';

export function useHaptic() {
  const triggerHaptic = useCallback((pattern: 'success' | 'error' | 'warning' | 'light' = 'light') => {
    triggerHapticFeedback(pattern);
  }, []);

  return { triggerHaptic };
}








