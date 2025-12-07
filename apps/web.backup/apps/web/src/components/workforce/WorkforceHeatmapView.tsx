/**
 * Workforce Heatmap View Component
 * Phase 2: Provider Heatmap & Coverage Visualization
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { Unit } from '@/lib/workforce/models';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { useHaptic } from '@/lib/hooks/use-haptic';

interface WorkforceHeatmapViewProps {
  units: Unit[];
  onUnitClick: (unitId: string) => void;
}

const unitTypeLabels: Record<Unit['type'], string> = {
  ICU: 'Intensive Care Unit',
  ED: 'Emergency Department',
  'Med/Surg': 'Medical/Surgical',
  OR: 'Operating Room',
  'L&D': 'Labor & Delivery',
  Psych: 'Psychiatry',
  Telemedicine: 'Telemedicine',
};

const readinessColors = {
  green: 'bg-green-500 hover:bg-green-600',
  amber: 'bg-yellow-500 hover:bg-yellow-600',
  red: 'bg-red-500 hover:bg-red-600',
};

export function WorkforceHeatmapView({ units, onUnitClick }: WorkforceHeatmapViewProps) {
  const { triggerHaptic } = useHaptic();

  const handleUnitClick = (unitId: string, hasDeficit: boolean) => {
    if (hasDeficit) {
      triggerHaptic('warning');
    }
    onUnitClick(unitId);
  };

  const unitsByType = units.reduce(
    (acc, unit) => {
      if (!acc[unit.type]) acc[unit.type] = [];
      acc[unit.type].push(unit);
      return acc;
    },
    {} as Record<Unit['type'], Unit[]>,
  );

  const unitTypes: Unit['type'][] = ['ICU', 'ED', 'Med/Surg', 'OR', 'L&D', 'Psych', 'Telemedicine'];

  return (
    <div className="space-y-6">
      {/* Coverage Deficit Alerts */}
      {units.some((u) => u.coverageDeficit > 0) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {units.filter((u) => u.coverageDeficit > 0).length} unit(s) have coverage deficits. Click
            to view details.
          </AlertDescription>
        </Alert>
      )}

      {/* Unit Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {unitTypes.map((type) => {
          const typeUnits = unitsByType[type] || [];
          if (typeUnits.length === 0) return null;

          return (
            <div key={type} className="space-y-2">
              <h3 className="text-lg font-semibold">{unitTypeLabels[type]}</h3>
              <div className="grid grid-cols-1 gap-2">
                {typeUnits.map((unit) => {
                  const hasDeficit = unit.coverageDeficit > 0;
                  const readinessColor = readinessColors[unit.readinessStatus];

                  return (
                    <Card
                      key={unit.id}
                      className={`cursor-pointer transition-all ${readinessColor} text-white`}
                      onClick={() => handleUnitClick(unit.id, hasDeficit)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-white">{unit.name}</h4>
                            <p className="text-sm text-white/80">{unit.providerCount} providers</p>
                          </div>
                          {hasDeficit && (
                            <Badge variant="destructive" className="bg-red-700">
                              -{unit.coverageDeficit}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1 mt-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/80">Trust Score</span>
                            <span className="font-medium">{unit.averageTrustScore.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/80">Readiness</span>
                            <span className="font-medium capitalize">{unit.readinessStatus}</span>
                          </div>
                          {unit.specialtyAlignment.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {unit.specialtyAlignment.slice(0, 2).map((specialty) => (
                                <Badge
                                  key={specialty}
                                  variant="secondary"
                                  className="text-xs bg-white/20 text-white border-white/30"
                                >
                                  {specialty}
                                </Badge>
                              ))}
                              {unit.specialtyAlignment.length > 2 && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-white/20 text-white border-white/30"
                                >
                                  +{unit.specialtyAlignment.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                          {unit.chainEvidenceHash && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-white/60">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Chain-backed evidence</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500" />
              <span>Fully Credentialed + Anchored</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-500" />
              <span>Partially Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500" />
              <span>High-Risk / Expiring</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

