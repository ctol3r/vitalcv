'use client';

/**
 * RetryableNpiLookup
 *
 * NPI lookup with exponential backoff retry on 5xx errors + inline help
 */

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { isRetryableError, retryWithBackoff } from '@/hooks/use-retry';
import { NpiClientError, lookupNpi } from '@/lib/npi-client';
import { NpiRecord } from '@/lib/npi-types';
import { AlertCircle, HelpCircle, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface RetryableNpiLookupProps {
  npi: string;
  onSuccess?: (record: NpiRecord) => void;
  onError?: (error: Error) => void;
  children?: (record: NpiRecord | null, isLoading: boolean, error: Error | null) => React.ReactNode;
}

export function RetryableNpiLookup({ npi, onSuccess, onError, children }: RetryableNpiLookupProps) {
  const [record, setRecord] = useState<NpiRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  const handleLookup = async () => {
    setIsLoading(true);
    setError(null);
    setRetryCount(0);

    try {
      const data = await retryWithBackoff(() => lookupNpi(npi), {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
      });

      setRecord(data);
      onSuccess?.(data);
    } catch (err) {
      const error = err as Error;

      // Check if error is retryable
      if (isRetryableError(error) && retryCount < 3) {
        setRetryCount((prev) => prev + 1);
        // Auto-retry with exponential backoff
        setTimeout(() => handleLookup(), 1000 * Math.pow(2, retryCount));
      } else {
        setError(error);
        onError?.(error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-load on mount
  useEffect(() => {
    if (npi) {
      handleLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npi]);

  // Render skeleton during loading
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // Render error with retry option
  if (error) {
    const isServerError =
      error instanceof NpiClientError && error.statusCode !== undefined && error.statusCode >= 500;

    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load NPI information</AlertTitle>
          <AlertDescription>
            {isServerError ? (
              <div className="space-y-2">
                <p>Server error (5xx). We'll automatically retry with exponential backoff.</p>
                {retryCount > 0 && <p className="text-xs">Retry attempt: {retryCount}/3</p>}
              </div>
            ) : (
              <p>{error.message}</p>
            )}
          </AlertDescription>
        </Alert>

        {/* Inline Help */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-2"
        >
          <HelpCircle className="h-4 w-4" />
          Need help?
        </Button>

        {showHelp && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Common issues:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Verify the NPI is 10 digits</li>
                  <li>Check your internet connection</li>
                  <li>The NPPES registry may be temporarily unavailable</li>
                  <li>Try again in a few moments</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Manual retry button */}
        <Button onClick={handleLookup} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry Now
        </Button>
      </div>
    );
  }

  // Render children with record
  if (children) {
    return <>{children(record, isLoading, error)}</>;
  }

  return null;
}
