/**
 * Toast Queue Hook
 * Manages toast notifications with queuing and deduplication
 */

'use client';

import { useToast } from '@/hooks/use-toast';
import { useCallback, useRef } from 'react';

interface ToastQueueOptions {
  maxToasts?: number;
  deduplicate?: boolean;
  deduplicationKey?: (toast: any) => string;
}

export function useToastQueue(options: ToastQueueOptions = {}) {
  const { toast } = useToast();
  const { maxToasts = 3, deduplicate = true } = options;
  const activeToasts = useRef<Set<string>>(new Set());
  const queuedToasts = useRef<any[]>([]);

  const showToast = useCallback(
    (toastData: Parameters<typeof toast>[0]) => {
      const key = options.deduplicationKey
        ? options.deduplicationKey(toastData)
        : `${toastData.title}-${toastData.description}`;

      // Check for duplicates
      if (deduplicate && activeToasts.current.has(key)) {
        return;
      }

      // Check queue limit
      if (activeToasts.current.size >= maxToasts) {
        queuedToasts.current.push({ ...toastData, key });
        return;
      }

      // Show toast
      activeToasts.current.add(key);
      toast({
        ...toastData,
        onDismiss: () => {
          activeToasts.current.delete(key);
          toastData.onDismiss?.();

          // Process queued toasts
          if (queuedToasts.current.length > 0) {
            const nextToast = queuedToasts.current.shift();
            if (nextToast) {
              setTimeout(() => showToast(nextToast), 100);
            }
          }
        },
      });
    },
    [toast, maxToasts, deduplicate, options]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description, variant: 'default' });
    },
    [showToast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description, variant: 'destructive' });
    },
    [showToast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      showToast({ title, description });
    },
    [showToast]
  );

  const clearQueue = useCallback(() => {
    queuedToasts.current = [];
  }, []);

  return {
    toast: showToast,
    success,
    error,
    info,
    clearQueue,
    queueLength: queuedToasts.current.length,
  };
}

