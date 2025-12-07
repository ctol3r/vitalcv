/**
 * NCQA 2025 Monitoring Windows - Batch 54
 * Enforces ≤120-day standard window, ≤90-day CVO window
 */

export function inWindow(pulledAt: Date, isCvo = false): boolean {
  const maxDays = isCvo ? 90 : 120;
  const diffDays = (Date.now() - pulledAt.getTime()) / 86400000;
  return diffDays <= maxDays;
}

export function getWindowStatus(pulledAt: Date, isCvo = false) {
  const maxDays = isCvo ? 90 : 120;
  const diffDays = Math.floor((Date.now() - pulledAt.getTime()) / 86400000);
  const remaining = maxDays - diffDays;

  return {
    inWindow: diffDays <= maxDays,
    daysElapsed: diffDays,
    daysRemaining: Math.max(0, remaining),
    maxDays,
    isCvo,
  };
}

// Cron job stubs - implement with actual scheduler
export const schedulePSVMonitoring = () => {
  console.log('[NCQA] Monthly PSV monitoring scheduler ready');
  // TODO: Wire to actual cron (node-cron, bull, etc.)
  // - License renewals
  // - Board certifications
  // - NPDB/OIG sanctions
};

