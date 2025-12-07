/**
 * Hiring Recommendations Component
 * Phase 3: Task 23 - Recommended hiring actions based on shortages
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { HiringRecommendation } from '@/lib/workforce/models';
import { ExternalLink, Users } from 'lucide-react';

interface HiringRecommendationsProps {
  recommendations: HiringRecommendation[];
}

const priorityColors = {
  critical: 'destructive',
  high: 'default',
  medium: 'secondary',
} as const;

export function HiringRecommendations({ recommendations }: HiringRecommendationsProps) {
  return (
    <div className="space-y-3">
      {recommendations.map((rec) => (
        <div
          key={rec.id}
          className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{rec.role}</span>
              <Badge variant={priorityColors[rec.priority]}>{rec.priority}</Badge>
              {rec.specialty && (
                <Badge variant="outline" className="text-xs">
                  {rec.specialty}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">{rec.reason}</p>
            {rec.suggestedJobPosting && (
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a href={rec.suggestedJobPosting} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  View Job Posting
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}








