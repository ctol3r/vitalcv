/**
 * Task 11: Next Possible Roles Prediction Chips
 */

'use client';

import { Briefcase, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PredictedRole } from '@/lib/growth/models';

interface NextRolesPredictionProps {
  roles: PredictedRole[];
}

export function NextRolesPrediction({ roles }: NextRolesPredictionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          Your Next Possible Roles
        </CardTitle>
        <CardDescription>AI-predicted career trajectory based on your profile</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.slice(0, 6).map((role, idx) => (
            <Card key={idx} className="border-2 hover:border-primary transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm mb-1">{role.role}</h3>
                    <p className="text-xs text-muted-foreground">{role.organization}</p>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {(role.matchScore * 100).toFixed(0)}%
                  </Badge>
                </div>
                <Progress value={role.matchScore * 100} className="h-2 mb-3" />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{role.timeToQualify}</span>
                </div>
                {role.requirements.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {role.requirements.slice(0, 2).map((req, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">
                        {req}
                      </Badge>
                    ))}
                    {role.requirements.length > 2 && (
                      <Badge variant="secondary" className="text-[10px]">
                        +{role.requirements.length - 2}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

