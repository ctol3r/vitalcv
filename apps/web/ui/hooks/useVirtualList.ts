'use client';

import { useCallback, useMemo, useState } from 'react';
import type { UIEvent } from 'react';

interface UseVirtualListOptions {
  itemCount: number;
  itemHeight: number;
  viewportHeight: number;
  overscan?: number;
}

export function useVirtualList({
  itemCount,
  itemHeight,
  viewportHeight,
  overscan = 4,
}: UseVirtualListOptions) {
  const [scrollTop, setScrollTop] = useState(0);

  const onScroll = useCallback((event: UIEvent<HTMLElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  const range = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      itemCount,
      Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan,
    );

    return {
      startIndex,
      endIndex,
    };
  }, [itemCount, itemHeight, overscan, scrollTop, viewportHeight]);

  return {
    offsetTop: range.startIndex * itemHeight,
    totalHeight: itemCount * itemHeight,
    startIndex: range.startIndex,
    endIndex: range.endIndex,
    onScroll,
  };
}
