/**
 * SyncStatusBar UI Component
 * Task: B244C-MOF-022
 *
 * Shows number of pending sync items, last sync time, and error indicator
 * Collapsible bar at top or bottom
 * Updates in real time from SyncSchedulerService
 * Optionally clickable to view details
 */

'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { syncSchedulerService, type SyncStatus } from '@/lib/services/SyncSchedulerService';
import { cn } from '@/lib/utils';

interface SyncStatusBarProps {
  position?: 'top' | 'bottom';
  onDetailsClick?: () => void;
}

export function SyncStatusBar({ position = 'bottom', onDetailsClick }: SyncStatusBarProps) {
  const [status, setStatus] = useState<SyncStatus>(syncSchedulerService.getStatus());
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = syncSchedulerService.subscribe((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleSync = async () => {
    await syncSchedulerService.sync();
  };

  const formatLastSync = (date: Date | null): string => {
    if (!date) return 'Never';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Don't show if no pending items and no errors
  if (status.pendingCount === 0 && !status.hasError) {
    return null;
  }

  return (
    <Card
      className={cn(
        'fixed left-0 right-0 z-40 rounded-none border-x-0 shadow-lg',
        position === 'top' ? 'top-0 border-b' : 'bottom-0 border-t',
      )}
    >
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {status.hasError ? (
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
          ) : status.pendingCount > 0 ? (
            <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {status.pendingCount > 0 && (
                <Badge variant="secondary" className="shrink-0">
                  {status.pendingCount} pending
                </Badge>
              )}
              <span className="text-sm font-medium truncate">
                {status.hasError
                  ? status.errorMessage || 'Sync error'
                  : status.pendingCount > 0
                    ? 'Syncing...'
                    : 'All synced'}
              </span>
            </div>
            {isExpanded && (
              <p className="text-xs text-muted-foreground mt-1">
                Last sync: {formatLastSync(status.lastSyncTime)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={status.pendingCount === 0}
            aria-label="Sync now"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
          {onDetailsClick && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDetailsClick}
              aria-label="View sync details"
            >
              Details
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

