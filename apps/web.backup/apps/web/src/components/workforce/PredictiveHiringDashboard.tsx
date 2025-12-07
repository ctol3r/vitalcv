/**
 * Predictive Hiring Dashboard Component
 * Phase 4: Task 28 - Predictive hiring dashboard (suggested job postings)
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { SpecialtyShortage } from '@/lib/workforce/models';
import { ExternalLink, Briefcase } from 'lucide-react';

interface PredictiveHiringDashboardProps {
  shortages: SpecialtyShortage[];
}

export function PredictiveHiringDashboard({ shortages }: PredictiveHiringDashboardProps) {
  const criticalShortages = shortages.filter((s) => s.urgency === 'critical' || s.urgency === 'high');

  if (criticalShortages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Predictive Hiring Dashboard</CardTitle>
        <CardDescription>Suggested job postings based on forecasted shortages</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {criticalShortages.map((shortage) => (
            <div
              key={shortage.specialty}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{shortage.specialty}</span>
                  <Badge variant={shortage.urgency === 'critical' ? 'destructive' : 'default'}>
                    {shortage.urgency}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Projected deficit of {shortage.deficit} clinicians by{' '}
                  {new Date(shortage.forecastDate).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Suggested: Post {shortage.deficit} {shortage.specialty} positions immediately
                </p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" asChild>
                <a
                  href={`/jobs/create?specialty=${encodeURIComponent(shortage.specialty)}&count=${shortage.deficit}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  Create Job Posting
                </a>
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}








