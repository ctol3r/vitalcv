/**
 * useLocalLinkUpdate
 *
 * Polls for AI-inferred link updates and refreshes the link graph
 */

import { useEffect } from 'react';

interface LinkUpdate {
  id: string;
  sourceId: string;
  targetId: string;
  targetName: string;
  targetType: string;
  score: number;
  relationship: string;
  inferred: boolean;
  createdAt: string;
}

export function useLocalLinkUpdate(onUpdate: (links: LinkUpdate[]) => void, interval = 15000) {
  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const response = await fetch('/api/links/recent');
        if (!response.ok) return;

        const data = await response.json();
        if (data?.links && isMounted) {
          onUpdate(data.links);
        }
      } catch (err) {
        // Silent fail - network error or endpoint not available
      }

      if (isMounted) {
        timeoutId = setTimeout(poll, interval);
      }
    };

    // Initial poll after a short delay
    timeoutId = setTimeout(poll, 1000);

    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [onUpdate, interval]);
}

/**
 * Hook to manually trigger link inference for an entity
 */
export function useLinkInference(entityId: string) {
  const triggerInference = async (): Promise<LinkUpdate[]> => {
    try {
      const response = await fetch(`/api/links/infer?entity=${entityId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to trigger link inference');
      }

      const data = await response.json();
      return data.links || [];
    } catch (error) {
      console.error('Link inference error:', error);
      return [];
    }
  };

  return { triggerInference };
}

/**
 * Hook to create a link between entities
 */
export function useCreateLink() {
  const createLink = async (sourceId: string, targetId: string, relationship: string) => {
    try {
      const response = await fetch('/api/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceId,
          targetId,
          relationship,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create link');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Create link error:', error);
      throw error;
    }
  };

  return { createLink };
}
