/**
 * useClearanceCheck Hook
 *
 * Fetches telehealth authorization status for a given patient state
 */

'use client';

import { useState } from 'react';

export interface TelehealthAuthzResult {
  authorized: boolean;
  patientState: string;
  rationale: string[];
  warnings?: string[];
  missingRequirements?: string[];
}

export function useClearanceCheck() {
  const [result, setResult] = useState<TelehealthAuthzResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const checkClearance = async (patientState: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual API call
      const response = await fetch(
        `/api/telehealth/check-authorization?state=${patientState}`
      );

      if (!response.ok) {
        throw new Error('Failed to check authorization');
      }

      const data: TelehealthAuthzResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));

      // Mock result for development
      setResult({
        authorized: false,
        patientState,
        rationale: [
          'No active license found in patient state',
          'No applicable compact membership detected',
        ],
        missingRequirements: [
          `Active medical license in ${patientState}`,
          'OR membership in applicable interstate compact',
        ],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return {
    result,
    isLoading,
    error,
    checkClearance,
    reset,
  };
}

