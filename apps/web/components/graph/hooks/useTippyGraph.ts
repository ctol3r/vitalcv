'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Instance } from 'tippy.js';
import tippy from 'tippy.js';
import type { GraphNode } from '@/components/graph-system/types';
import { buildGraphTooltipContent } from '@/components/graph/GraphTooltip';
import { motionDurations } from '@/ui/animation/motion';

interface TooltipPoint {
  clientX: number;
  clientY: number;
}

export function useTippyGraph(canvasRef: RefObject<HTMLCanvasElement | null>) {
  const tooltipRef = useRef<Instance | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const instance = tippy(canvas, {
      trigger: 'manual',
      arrow: true,
      theme: 'vital-graph',
      placement: 'top',
      animation: 'fade',
      duration: Math.round(motionDurations.tooltip * 1000),
      interactive: false,
      offset: [0, 14],
      appendTo: () => document.body,
    });

    tooltipRef.current = instance;

    return () => {
      instance.destroy();
      tooltipRef.current = null;
    };
  }, [canvasRef]);

  const hideTooltip = useCallback(() => {
    tooltipRef.current?.hide();
  }, []);

  const showTooltip = useCallback((
    node: GraphNode,
    point: TooltipPoint,
    relationshipCount: number,
  ) => {
    const tooltip = tooltipRef.current;
    if (!tooltip) {
      return;
    }

    tooltip.setProps({
      getReferenceClientRect: () => ({
        width: 0,
        height: 0,
        top: point.clientY,
        bottom: point.clientY,
        left: point.clientX,
        right: point.clientX,
        x: point.clientX,
        y: point.clientY,
        toJSON: () => '',
      }),
    });
    tooltip.setContent(buildGraphTooltipContent({ node, relationshipCount }));
    tooltip.show();
  }, []);

  return {
    showTooltip,
    hideTooltip,
  };
}
