'use client';

/**
 * Autopilot Toggle Component
 * Simple toggle for enabling/disabling autopilot
 */

import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Zap } from 'lucide-react';

const AUTOPILOT_STORAGE_KEY = 'vitalcv_autopilot_enabled';

interface AutopilotToggleProps {
  onToggle?: (enabled: boolean) => void;
  showDescription?: boolean;
  compact?: boolean;
}

export function AutopilotToggle({
  onToggle,
  showDescription = true,
  compact = false,
}: AutopilotToggleProps) {
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(AUTOPILOT_STORAGE_KEY);
    return stored !== 'false'; // Default to enabled
  });

  useEffect(() => {
    localStorage.setItem(AUTOPILOT_STORAGE_KEY, String(enabled));
    onToggle?.(enabled);
  }, [enabled, onToggle]);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-yellow-500" />
        <Label htmlFor="autopilot-toggle" className="text-sm font-medium">
          Autopilot
        </Label>
        <Switch
          id="autopilot-toggle"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <CardTitle>Autopilot</CardTitle>
          </div>
          <Switch
            id="autopilot-toggle"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        {showDescription && (
          <CardDescription>
            Automatically manage your credentials and keep everything up to date
          </CardDescription>
        )}
      </CardHeader>
      {showDescription && (
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When enabled, Autopilot will verify credentials, sync licenses, refresh DEA status,
            and recompute trust scores automatically.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

