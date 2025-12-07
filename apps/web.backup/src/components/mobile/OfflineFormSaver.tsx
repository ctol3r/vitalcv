/**
 * OfflineFormSaver UI Component
 * Task: B244C-MOF-024
 *
 * Allows users to save form inputs offline when network is unavailable
 * Indicates saved status, triggers sync when back online
 * Provides restore option, integrates with LocalDataStore
 */

'use client';

import { useEffect, useState } from 'react';
import { Save, Check, RotateCcw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { localDataStore } from '@/lib/services/LocalDataStore';
import { syncSchedulerService } from '@/lib/services/SyncSchedulerService';
import { deviceNetworkStatusService } from '@/lib/services/DeviceNetworkStatusService';
import { cn } from '@/lib/utils';

interface OfflineFormSaverProps {
  formId: string;
  formData: Record<string, unknown>;
  onRestore?: (data: Record<string, unknown>) => void;
  className?: string;
}

export function OfflineFormSaver({
  formId,
  formData,
  onRestore,
  className,
}: OfflineFormSaverProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [hasStoredData, setHasStoredData] = useState(false);

  useEffect(() => {
    // Check if form data is already saved
    checkStoredData();

    // Listen to network status
    const unsubscribe = deviceNetworkStatusService.subscribe((status) => {
      setIsOnline(status === 'online');
      if (status === 'online' && hasStoredData) {
        // Auto-sync when back online
        syncStoredData();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [formId, hasStoredData]);

  const checkStoredData = async () => {
    try {
      const stored = await localDataStore.get<Record<string, unknown>>(`form-${formId}`);
      setHasStoredData(stored !== null);
    } catch (error) {
      console.error('Failed to check stored data:', error);
    }
  };

  const handleSave = async () => {
    try {
      await localDataStore.save({
        key: `form-${formId}`,
        data: formData,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      setIsSaved(true);
      setHasStoredData(true);

      // Add to sync queue
      syncSchedulerService.addToQueue({
        type: 'form',
        data: { formId, formData },
      });

      // Auto-sync if online
      if (isOnline) {
        await syncSchedulerService.sync();
      }

      // Reset saved state after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save form data:', error);
    }
  };

  const handleRestore = async () => {
    try {
      const stored = await localDataStore.get<Record<string, unknown>>(`form-${formId}`);
      if (stored && onRestore) {
        onRestore(stored);
        setHasStoredData(false);
      }
    } catch (error) {
      console.error('Failed to restore form data:', error);
    }
  };

  const syncStoredData = async () => {
    try {
      await syncSchedulerService.sync();
      // Check if data was successfully synced and can be cleared
      const stored = await localDataStore.get<Record<string, unknown>>(`form-${formId}`);
      if (!stored) {
        setHasStoredData(false);
      }
    } catch (error) {
      console.error('Failed to sync stored data:', error);
    }
  };

  if (isOnline && !hasStoredData) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-muted rounded-md', className)}>
      {!isOnline && (
        <>
          <WifiOff className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm text-muted-foreground">Offline</span>
        </>
      )}

      {isSaved ? (
        <>
          <Check className="h-4 w-4 text-green-600" aria-hidden="true" />
          <span className="text-sm text-green-600">Saved</span>
        </>
      ) : (
        <>
          {hasStoredData && (
            <Badge variant="secondary" className="text-xs">
              Saved
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={isSaved}
            className="h-8"
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </>
      )}

      {hasStoredData && onRestore && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestore}
          className="h-8"
          aria-label="Restore saved form data"
        >
          <RotateCcw className="h-4 w-4 mr-1" />
          Restore
        </Button>
      )}
    </div>
  );
}

