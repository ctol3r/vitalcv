/**
 * JSON formatter for state reports
 */

import type { StateReport } from '../types';

export function formatAsJson(report: StateReport): string {
  return JSON.stringify(report, null, 2);
}

