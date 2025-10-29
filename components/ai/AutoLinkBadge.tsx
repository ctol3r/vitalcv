'use client';

/**
 * AutoLinkBadge
 *
 * Small badge showing AI-discovered link count for an entity
 */

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AutoLinkBadgeProps {
  entityId: string;
  variant?: 'default' | 'compact';
  showCount?: boolean;
}

export function AutoLinkBadge({
  entityId,
  variant = 'default',
  showCount = true,
}: AutoLinkBadgeProps) {
  const [linkCount, setLinkCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLinks = async () => {
      try {
        const response = await fetch(`/api/links?entity=${entityId}`);
        if (!response.ok) return;

        const data = await response.json();
        setLinkCount(data.links?.length || 0);
      } catch (err) {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinks();
  }, [entityId]);

  if (isLoading) return null;
  if (linkCount === 0) return null;

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {linkCount}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {linkCount} AI-discovered link{linkCount !== 1 ? 's' : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="secondary" className="text-xs">
      <Sparkles className="h-3 w-3 mr-1" />
      {showCount ? `${linkCount} link${linkCount !== 1 ? 's' : ''}` : 'AI-Linked'}
    </Badge>
  );
}
