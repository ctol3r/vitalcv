/**
 * OfflineIndicator UI Component
 * Task: B244C-MOF-021
 *
 * Displays current network status (online/offline/connecting)
 * Shows icons and text, listens to DeviceNetworkStatusService
 * Accessible to screen readers, hidden when online
 */

'use client';

import { useEffect, useState } from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { deviceNetworkStatusService, type NetworkStatus } from '@/lib/services/DeviceNetworkStatusService';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [status, setStatus] = useState<NetworkStatus>('online');

  useEffect(() => {
    const unsubscribe = deviceNetworkStatusService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Hidden when online
  if (status === 'online') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'offline':
        return {
          icon: WifiOff,
          text: 'You are offline',
          description: 'Some features may not be available until your connection is restored.',
          variant: 'destructive' as const,
        };
      case 'connecting':
        return {
          icon: Loader2,
          text: 'Connecting...',
          description: 'Attempting to restore connection.',
          variant: 'default' as const,
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const Icon = config.icon;

  return (
    <Alert
      variant={config.variant}
      className={cn(
        'fixed top-0 left-0 right-0 z-50 rounded-none border-x-0 border-t-0',
        'md:top-auto md:bottom-0',
      )}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <Icon
        className={cn(
          'h-4 w-4',
          status === 'connecting' && 'animate-spin',
        )}
        aria-hidden="true"
      />
      <AlertDescription>
        <div className="flex items-center gap-2">
          <strong>{config.text}</strong>
          <span className="sr-only">
            {status === 'offline' ? 'Network connection is offline' : 'Network connection is being restored'}
          </span>
        </div>
        <p className="mt-1 text-sm">{config.description}</p>
      </AlertDescription>
    </Alert>
  );
}

