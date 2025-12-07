/**
 * Recruiter Integration Component
 * Phase 5: Task 35 - Recruiter integration ("Find candidates for this gap")
 */

'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ExternalLink } from 'lucide-react';

interface Gap {
  id: string;
  role: string;
  specialty: string;
  deficit: number;
  urgency: 'critical' | 'high' | 'medium';
}

export function RecruiterIntegration() {
  const gaps: Gap[] = [
    {
      id: 'gap-1',
      role: 'MD',
      specialty: 'Critical Care',
      deficit: 3,
      urgency: 'critical',
    },
    {
      id: 'gap-2',
      role: 'RN',
      specialty: 'Emergency Medicine',
      deficit: 5,
      urgency: 'high',
    },
  ];

  const handleFindCandidates = (gap: Gap) => {
    // TODO: Integrate with recruiter system
    window.open(`/recruiter/candidates?role=${gap.role}&specialty=${gap.specialty}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">Staffing Gaps</h4>
        <Badge variant="outline">{gaps.length} gaps</Badge>
      </div>
      <div className="space-y-2">
        {gaps.map((gap) => (
          <div key={gap.id} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">
                  {gap.role} - {gap.specialty}
                </span>
                <Badge
                  variant={gap.urgency === 'critical' ? 'destructive' : gap.urgency === 'high' ? 'default' : 'secondary'}
                >
                  {gap.urgency}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">Deficit: {gap.deficit} clinicians</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFindCandidates(gap)}
              className="gap-2"
            >
              <Search className="h-3 w-3" />
              Find Candidates
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}








