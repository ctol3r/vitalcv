/**
 * B203A-ML-005: PredictionWindowConstants
 *
 * Defines prediction windows for forecasting privilege risk at different time horizons.
 */

export const PREDICTION_WINDOWS = {
  DAYS_7: 7,
  DAYS_14: 14,
  DAYS_30: 30,
  DAYS_60: 60,
} as const;

export type PredictionWindow = typeof PREDICTION_WINDOWS[keyof typeof PREDICTION_WINDOWS];

export const PREDICTION_WINDOW_NAMES = {
  [PREDICTION_WINDOWS.DAYS_7]: '7d',
  [PREDICTION_WINDOWS.DAYS_14]: '14d',
  [PREDICTION_WINDOWS.DAYS_30]: '30d',
  [PREDICTION_WINDOWS.DAYS_60]: '60d',
} as const;

/**
 * Get prediction window name
 */
export function getPredictionWindowName(window: PredictionWindow): string {
  return PREDICTION_WINDOW_NAMES[window] || `${window}d`;
}

/**
 * Get all prediction windows as array
 */
export function getAllPredictionWindows(): PredictionWindow[] {
  return Object.values(PREDICTION_WINDOWS);
}

/**
 * Calculate target date for a prediction window
 */
export function calculateTargetDate(window: PredictionWindow, fromDate: Date = new Date()): Date {
  const targetDate = new Date(fromDate);
  targetDate.setDate(targetDate.getDate() + window);
  return targetDate;
}

