'use client';

/**
 * Graph Controls
 *
 * Sliders for gravity, repel, and link distance with reduced-motion support
 */

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Maximize2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GraphControlsProps {
  center: number;
  repel: number;
  linkDist: number;
  onCenterChange: (value: number) => void;
  onRepelChange: (value: number) => void;
  onLinkDistChange: (value: number) => void;
  onReset?: () => void;
  onFitToView?: () => void;
  className?: string;
}

export function GraphControls({
  center,
  repel,
  linkDist,
  onCenterChange,
  onRepelChange,
  onLinkDistChange,
  onReset,
  onFitToView,
  className,
}: GraphControlsProps) {
  const [hasReducedMotion, setHasReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setHasReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setHasReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Adjust values for reduced motion (less force, more stable)
  const adjustedCenter = hasReducedMotion ? Math.min(center, 0.3) : center;
  const adjustedRepel = hasReducedMotion ? Math.max(repel, -500) : repel;
  const adjustedLinkDist = hasReducedMotion ? Math.min(linkDist, 120) : linkDist;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Graph Controls</h3>
        <div className="flex gap-2">
          {onFitToView && (
            <Button variant="ghost" size="sm" onClick={onFitToView}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {hasReducedMotion && (
        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs text-blue-800 dark:text-blue-200">
          <strong>Reduced Motion Enabled:</strong> Graph forces adjusted for smoother experience.
        </div>
      )}

      <div className="space-y-5">
        <Control
          label="Center Force"
          value={adjustedCenter}
          min={0}
          max={hasReducedMotion ? 0.5 : 1}
          step={0.05}
          onChange={onCenterChange}
          description="Controls how nodes cluster toward center"
        />
        <Control
          label="Repel Force"
          value={adjustedRepel}
          min={hasReducedMotion ? -1000 : -2000}
          max={-50}
          step={50}
          onChange={onRepelChange}
          description="Controls node separation (negative values push apart)"
        />
        <Control
          label="Link Distance"
          value={adjustedLinkDist}
          min={20}
          max={hasReducedMotion ? 180 : 240}
          step={5}
          onChange={onLinkDistChange}
          description="Preferred distance between connected nodes"
        />
      </div>

      {/* Preset Buttons */}
      <div className="mt-4 space-y-2">
        <Label className="text-sm font-medium">Presets</Label>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onCenterChange(0.5);
              onRepelChange(-1000);
              onLinkDistChange(80);
            }}
          >
            Balanced
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onCenterChange(0.8);
              onRepelChange(-1500);
              onLinkDistChange(100);
            }}
          >
            Tight
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onCenterChange(0.2);
              onRepelChange(-500);
              onLinkDistChange(150);
            }}
          >
            Spread Out
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  description?: string;
}

function Control({ label, value, min, max, step, onChange, description }: ControlProps) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <Label className="text-sm">{label}</Label>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <span className="text-xs text-muted-foreground font-mono">{value}</span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="w-full"
      />
    </div>
  );
}
