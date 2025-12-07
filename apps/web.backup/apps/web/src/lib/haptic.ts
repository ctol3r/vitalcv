/**
 * Haptic feedback utility for mobile devices
 * Uses Web Vibration API when available
 */

export function triggerHapticFeedback(pattern: 'success' | 'error' | 'warning' | 'light' = 'light') {
  if (typeof navigator === 'undefined' || !navigator.vibrate) {
    return; // Not supported
  }

  const patterns: Record<string, number | number[]> = {
    success: [100, 50, 100], // Double pulse
    error: [200], // Long pulse
    warning: [100, 30, 100, 30, 100], // Triple pulse
    light: [50], // Single light pulse
  };

  navigator.vibrate(patterns[pattern] || patterns.light);
}

/**
 * Haptic feedback for proof confirmation
 */
export function confirmProofHaptic() {
  triggerHapticFeedback('success');
}








