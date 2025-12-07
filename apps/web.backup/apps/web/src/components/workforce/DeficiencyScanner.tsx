/**
 * Deficiency Scanner Component
 * Phase 3: Task 19 - Deficiency scanner (missing certs, expiring licenses, DEA shortages)
 */

'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { Deficiency } from '@/lib/workforce/models';
import { AlertTriangle, Clock, ShieldX, FileX } from 'lucide-react';

interface DeficiencyScannerProps {
  deficiencies: Deficiency[];
}

const deficiencyIcons = {
  missing_cert: FileX,
  expiring_license: Clock,
  dea_shortage: ShieldX,
  chain_stale: AlertTriangle,
};

const severityColors = {
  critical: 'destructive',
  high: 'destructive',
  medium: 'default',
  low: 'secondary',
} as const;

export function DeficiencyScanner({ deficiencies }: DeficiencyScannerProps) {
  if (deficiencies.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>No deficiencies detected. All credentials are current.</AlertDescription>
      </Alert>
    );
  }

  const groupedByType = deficiencies.reduce(
    (acc, def) => {
      if (!acc[def.type]) acc[def.type] = [];
      acc[def.type].push(def);
      return acc;
    },
    {} as Record<Deficiency['type'], Deficiency[]>,
  );

  return (
    <div className="space-y-4">
      {Object.entries(groupedByType).map(([type, defs]) => {
        const Icon = deficiencyIcons[type];
        const criticalDefs = defs.filter((d) => d.severity === 'critical' || d.severity === 'high');

        return (
          <Alert
            key={type}
            variant={criticalDefs.length > 0 ? 'destructive' : 'default'}
            className="border-l-4"
          >
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center justify-between">
              <span className="capitalize">{type.replace(/_/g, ' ')}</span>
              <Badge variant={severityColors[defs[0].severity]}>{defs.length}</Badge>
            </AlertTitle>
            <AlertDescription>
              <div className="space-y-2 mt-2">
                {defs.map((def) => (
                  <div key={def.id} className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{def.description}</p>
                      {def.deadline && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Deadline: {new Date(def.deadline).toLocaleDateString()}
                        </p>
                      )}
                      {def.affectedClinicians.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Affects {def.affectedClinicians.length} clinician(s)
                        </p>
                      )}
                    </div>
                    <Badge variant={severityColors[def.severity]} className="ml-2">
                      {def.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
}








