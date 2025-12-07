/**
 * Facility Privileging Engine - Privilege Required Badge
 * Phase 5 Task 36: "Privilege Required" marker in Jobs Portal
 */

'use client';

import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface PrivilegeRequiredBadgeProps {
  privilegeCodes: string[];
  className?: string;
}

export function PrivilegeRequiredBadge({
  privilegeCodes,
  className,
}: PrivilegeRequiredBadgeProps) {
  if (privilegeCodes.length === 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`gap-1 ${className}`}>
            <Shield className="h-3 w-3" />
            {privilegeCodes.length} Privilege{privilegeCodes.length !== 1 ? 's' : ''} Required
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Required Privileges:</p>
            <ul className="list-disc list-inside text-xs">
              {privilegeCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

