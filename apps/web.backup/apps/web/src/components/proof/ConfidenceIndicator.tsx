'use client';

import { Shield, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface ConfidenceIndicatorProps {
  confidence: number;
  showLabel?: boolean;
}

export function ConfidenceIndicator({ confidence, showLabel = true }: ConfidenceIndicatorProps) {
  const getColor = () => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStrength = () => {
    if (confidence >= 0.8) return 'Strong';
    if (confidence >= 0.6) return 'Moderate';
    return 'Weak';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          {showLabel && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Proof Strength</span>
              <span className={`text-sm font-bold ${getColor()}`}>{getStrength()}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {confidence >= 0.8 ? (
              <Shield className={`h-4 w-4 ${getColor()}`} />
            ) : (
              <AlertTriangle className={`h-4 w-4 ${getColor()}`} />
            )}
            <Progress value={confidence * 100} className="flex-1" />
            <span className={`text-sm font-medium ${getColor()}`}>
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}








