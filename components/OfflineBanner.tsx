'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkBackendHealth = async () => {
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

        const response = await fetch(`${BACKEND_URL}/healthz`, {
          method: 'GET',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          setBackendAvailable(true);
        } else {
          setBackendAvailable(false);
        }
      } catch (error) {
        setBackendAvailable(false);
      } finally {
        setChecking(false);
      }
    };

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
  }, []);

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
