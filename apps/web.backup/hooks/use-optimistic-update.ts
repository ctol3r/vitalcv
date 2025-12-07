/**
 * Optimistic Update Hook
 * Provides optimistic UI updates with automatic rollback on error
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface OptimisticUpdateOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
  rollbackDelay?: number;
}

export function useOptimisticUpdate<T, TData = any>(
  initialData: T,
  updateFn: (data: TData) => Promise<T>,
  options: OptimisticUpdateOptions<T> = {}
) {
  const [data, setData] = useState<T>(initialData);
  const [isUpdating, setIsUpdating] = useState(false);
  const previousDataRef = useRef<T>(initialData);
  const { toast } = useToast();

  const update = useCallback(
    async (newData: TData, optimisticData?: Partial<T>) => {
      setIsUpdating(true);

      // Store current data for potential rollback
      previousDataRef.current = data;

      // Apply optimistic update if provided
      if (optimisticData) {
        setData((prev) => ({ ...prev, ...optimisticData }));
      }

      try {
        const result = await updateFn(newData);
        setData(result);

        if (options.successMessage) {
          toast({
            title: 'Success',
            description: options.successMessage,
          });
        }

        if (options.onSuccess) {
          options.onSuccess(result);
        }

        return { success: true, data: result };
      } catch (error) {
        // Rollback to previous data
        setTimeout(() => {
          setData(previousDataRef.current);
        }, options.rollbackDelay || 0);

        const err = error instanceof Error ? error : new Error('Update failed');

        if (options.errorMessage) {
          toast({
            title: 'Error',
            description: options.errorMessage,
            variant: 'destructive',
          });
        }

        if (options.onError) {
          options.onError(err);
        }

        return { success: false, error: err };
      } finally {
        setIsUpdating(false);
      }
    },
    [data, updateFn, options, toast]
  );

  const reset = useCallback(() => {
    setData(initialData);
  }, [initialData]);

  return {
    data,
    update,
    reset,
    isUpdating,
  };
}

// Hook for optimistic list updates
export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const addOptimistic = useCallback((item: T) => {
    setItems((prev) => [item, ...prev]);
    setPending((prev) => new Set(prev).add(item.id));
  }, []);

  const removeOptimistic = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const updateOptimistic = useCallback((id: string, updates: Partial<T>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const confirmOptimistic = useCallback((id: string, confirmedItem?: T) => {
    if (confirmedItem) {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? confirmedItem : item))
      );
    }
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const isPending = useCallback((id: string) => pending.has(id), [pending]);

  return {
    items,
    addOptimistic,
    removeOptimistic,
    updateOptimistic,
    confirmOptimistic,
    isPending,
    pendingCount: pending.size,
  };
}

