'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

// Prefer same-origin Next proxy to avoid CORS issues in browsers.
const HEALTH_URL = '/api/health';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [checking, setChecking] = useState(true);

  const checkBackendHealth = useCallback(async () => {
    if (!navigator.onLine) {
      setIsOnline(false);
      setBackendAvailable(false);
      setChecking(false);
      return;
    }

    setIsOnline(true);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(HEALTH_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeoutId);
      setBackendAvailable(response.ok);
    } catch (_error) {
      setBackendAvailable(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkBackendHealth();

    const handleOnline = () => {
      setIsOnline(true);
      checkBackendHealth();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setBackendAvailable(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll every 30 seconds
    const intervalId = setInterval(checkBackendHealth, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(intervalId);
    };
  }, [checkBackendHealth]);

  if (checking) {
    return null;
  }

  if (!isOnline) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          <strong>You are offline.</strong> Some features may not be available until your connection
          is restored.
        </AlertDescription>
      </Alert>
    );
  }

  if (!backendAvailable) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <strong>Backend service unavailable.</strong> Credential verification and issuance are
              currently disabled. The service will automatically reconnect when available.
            </div>
            <Button variant="ghost" size="sm" onClick={checkBackendHealth} className="ml-4">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
