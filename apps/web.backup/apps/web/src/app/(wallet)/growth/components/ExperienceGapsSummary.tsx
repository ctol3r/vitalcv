/**
 * Task 15: Experience Gaps Summary
 */

'use client';

import { AlertTriangle, Target, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ExperienceGap } from '@/lib/growth/models';

interface ExperienceGapsSummaryProps {
  gaps: ExperienceGap[];
}

export function ExperienceGapsSummary({ gaps }: ExperienceGapsSummaryProps) {
  const highPriority = gaps.filter((g) => g.priority === 'high');
  const mediumPriority = gaps.filter((g) => g.priority === 'medium');

  const getTypeIcon = (type: ExperienceGap['type']) => {
    switch (type) {
      case 'certification':
        return '🎓';
      case 'training':
        return '📚';
      case 'credential':
        return '🪪';
      case 'cme':
        return '📖';
      default:
        return '⚠️';
    }
  };

  const getTypeColor = (type: ExperienceGap['type']) => {
    switch (type) {
      case 'certification':
        return 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/20';
      case 'training':
        return 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950/20';
      case 'credential':
        return 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/20';
      case 'cme':
        return 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950/20';
      default:
        return '';
    }
  };

  if (gaps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Experience Gaps
          </CardTitle>
          <CardDescription>No gaps identified</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Your credentials and experience are up to date!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Experience Gaps
        </CardTitle>
        <CardDescription>
          {highPriority.length > 0 && (
            <span className="text-red-600 font-medium">
              {highPriority.length} high priority gap(s) need attention
            </span>
          )}
          {highPriority.length === 0 && (
            <span>{gaps.length} gap(s) identified for improvement</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {[...highPriority, ...mediumPriority, ...gaps.filter((g) => g.priority === 'low')]
          .slice(0, 6)
          .map((gap) => (
            <Card
              key={gap.id}
              className={`border-2 ${getTypeColor(gap.type)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">{getTypeIcon(gap.type)}</div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm">{gap.name}</h3>
                      <Badge
                        variant={
                          gap.priority === 'high'
                            ? 'destructive'
                            : gap.priority === 'medium'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {gap.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{gap.description}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Impact:</p>
                      <p className="text-xs text-muted-foreground">{gap.impact}</p>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        {gap.actionRequired}
                      </p>
                      {gap.deadline && (
                        <Badge variant="outline" className="text-xs">
                          Due: {new Date(gap.deadline).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {gaps.length > 6 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm">
              View all {gaps.length} gaps
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

