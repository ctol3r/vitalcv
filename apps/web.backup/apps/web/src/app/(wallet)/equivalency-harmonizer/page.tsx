'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EquivalencyHarmonizer {
  clinicianId: string;
  drift: Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
  }>;
  crossBorderPrivileges: Record<string, unknown>;
  forecast: {
    predictedShifts: Array<{
      country: string;
      shift: string;
      timeframe: string;
    }>;
  };
}

export default function EquivalencyHarmonizerPage() {
  const [harmonizer, setHarmonizer] = useState<EquivalencyHarmonizer | null>(null);
  const [loading, setLoading] = useState(false);
  const [clinicianId, setClinicianId] = useState('');

  const fetchHarmonizer = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/equivalency-harmonizer/${clinicianId}`);
      const data = await res.json();
      setHarmonizer(data);
    } catch (error) {
      console.error('Failed to fetch equivalency harmonizer:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Credential Equivalency Harmonizer</h1>
        <p className="text-muted-foreground mt-2">
          Globally harmonize credential equivalency across countries, roles, regulators & training pathways
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician ID</CardTitle>
          <CardDescription>Enter clinician ID to view equivalency harmonization</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Enter clinician ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchHarmonizer}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {harmonizer && (
        <div className="space-y-6">
          {harmonizer.drift.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Equivalency Drift</CardTitle>
                <CardDescription>Detected equivalency mismatches</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {harmonizer.drift.map((driftItem, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={
                          driftItem.severity === 'severe' ? 'destructive' :
                          driftItem.severity === 'moderate' ? 'default' : 'outline'
                        }>
                          {driftItem.severity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{driftItem.type}</span>
                      </div>
                      <div className="text-sm">{driftItem.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Cross-Border Privileges</CardTitle>
              <CardDescription>Aligned privileges internationally</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                {Object.keys(harmonizer.crossBorderPrivileges).length > 0
                  ? `${Object.keys(harmonizer.crossBorderPrivileges).length} privilege alignments configured`
                  : 'No cross-border privileges configured'}
              </div>
            </CardContent>
          </Card>

          {harmonizer.forecast.predictedShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Predicted Equivalency Shifts</CardTitle>
                <CardDescription>Forecasted changes in equivalency rules</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {harmonizer.forecast.predictedShifts.map((shift, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{shift.country}</Badge>
                        <span className="text-sm text-muted-foreground">{shift.timeframe}</span>
                      </div>
                      <div className="text-sm">{shift.shift}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}








