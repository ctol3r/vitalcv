/**
 * B207A-LIFE-004: LifecycleProjectionConstants
 *
 * Defines projection windows: 3mo, 6mo, 12mo, 24mo, 36mo
 */

/**
 * Projection window types
 */
export type ProjectionWindow = '3mo' | '6mo' | '12mo' | '24mo' | '36mo';

/**
 * Projection window definitions in months
 */
export const PROJECTION_WINDOWS: Record<ProjectionWindow, number> = {
  '3mo': 3,
  '6mo': 6,
  '12mo': 12,
  '24mo': 24,
  '36mo': 36,
} as const;

/**
 * All projection windows in order
 */
export const PROJECTION_WINDOW_ORDER: ProjectionWindow[] = ['3mo', '6mo', '12mo', '24mo', '36mo'];

/**
 * Get projection window in days
 */
export function getProjectionWindowDays(window: ProjectionWindow): number {
  return PROJECTION_WINDOWS[window] * 30; // Approximate 30 days per month
}

/**
 * Get projection window in milliseconds
 */
export function getProjectionWindowMs(window: ProjectionWindow): number {
  return getProjectionWindowDays(window) * 24 * 60 * 60 * 1000;
}

/**
 * Get projection date from a base date
 */
export function getProjectionDate(baseDate: Date, window: ProjectionWindow): Date {
  const months = PROJECTION_WINDOWS[window];
  const projectedDate = new Date(baseDate);
  projectedDate.setMonth(projectedDate.getMonth() + months);
  return projectedDate;
}

/**
 * Get all projection dates from a base date
 */
export function getAllProjectionDates(baseDate: Date): Record<ProjectionWindow, Date> {
  return {
    '3mo': getProjectionDate(baseDate, '3mo'),
    '6mo': getProjectionDate(baseDate, '6mo'),
    '12mo': getProjectionDate(baseDate, '12mo'),
    '24mo': getProjectionDate(baseDate, '24mo'),
    '36mo': getProjectionDate(baseDate, '36mo'),
  };
}

/**
 * Default projection intervals for lifecycle analysis
 */
export const DEFAULT_PROJECTION_INTERVALS: ProjectionWindow[] = ['3mo', '6mo', '12mo', '24mo', '36mo'];

/**
 * Short-term projection windows (for immediate planning)
 */
export const SHORT_TERM_WINDOWS: ProjectionWindow[] = ['3mo', '6mo'];

/**
 * Medium-term projection windows (for strategic planning)
 */
export const MEDIUM_TERM_WINDOWS: ProjectionWindow[] = ['12mo', '24mo'];

/**
 * Long-term projection windows (for long-range planning)
 */
export const LONG_TERM_WINDOWS: ProjectionWindow[] = ['36mo'];

