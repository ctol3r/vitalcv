/**
 * Role Coverage Bar Component
 * Phase 1: Task 5 - Role coverage visualization (RN/MD/PA/CRNA/PT/Specialists)
 */

'use client';

import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { RoleCoverage } from '@/lib/workforce/models';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react';

interface RoleCoverageBarProps {
  data: RoleCoverage[];
}

const roleColors: Record<string, string> = {
  RN: 'bg-blue-500',
  MD: 'bg-green-500',
  PA: 'bg-purple-500',
  CRNA: 'bg-orange-500',
  PT: 'bg-pink-500',
  Specialist: 'bg-indigo-500',
  Other: 'bg-gray-500',
};

export function RoleCoverageBar({ data }: RoleCoverageBarProps) {
  const getCoverageStatus = (coverage: number) => {
    if (coverage >= 100) return { icon: CheckCircle2, color: 'text-green-600', label: 'Fully Covered' };
    if (coverage >= 80) return { icon: AlertCircle, color: 'text-yellow-600', label: 'Adequate' };
    return { icon: XCircle, color: 'text-red-600', label: 'Understaffed' };
  };

  return (
    <div className="space-y-4">
      {data.map((role) => {
        const status = getCoverageStatus(role.coveragePercentage);
        const StatusIcon = status.icon;

        return (
          <div key={role.role} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${roleColors[role.role] || 'bg-gray-500'}`} />
                <span className="font-medium">{role.role}</span>
                <Badge variant="outline" className="ml-2">
                  {role.count} / {role.targetCount}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <StatusIcon className={`h-4 w-4 ${status.color}`} />
                <span className={`text-sm font-medium ${status.color}`}>
                  {role.coveragePercentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <Progress value={role.coveragePercentage} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Avg Trust: <span className="font-medium">{role.averageTrustScore.toFixed(2)}</span>
              </span>
              <span>
                Fully Credentialed: <span className="font-medium">{role.fullyCredentialed}</span>
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}








