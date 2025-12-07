'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface LifecycleFabric {
  clinicianId: string;
  coherence: {
    coherent: boolean;
    mismatches: Array<{ segment1: string; segment2: string; issue: string }>;
  };
  integrityBreaks: Array<{
    type: string;
    severity: 'minor' | 'moderate' | 'severe';
    description: string;
    suggestedFixes: string[];
  }>;
  recoverySuggestions: Array<{
    action: 'renewal' | 'attestation' | 'evidence_update';
    priority: 'low' | 'medium' | 'high';
    description: string;
  }>;
  driftForecast: {
    predictedDecay: number;
    timeframe: string;
    factors: string[];
  };
  regulatoryOverlay: Record<string, unknown>;
}

export default function LifecycleFabricPage() {
  const [fabric, setFabric] = useState<LifecycleFabric | null>(null);
  const [loading, setLoading] = useState(false);
  const [clinicianId, setClinicianId] = useState('');

  const fetchFabric = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lifecycle-fabric/${clinicianId}`);
      const data = await res.json();
      setFabric(data);
    } catch (error) {
      console.error('Failed to fetch lifecycle fabric:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clinician Lifecycle Integrity Fabric</h1>
        <p className="text-muted-foreground mt-2">
          Weave every credential, privilege, safety event, regulatory decision, and identity factor into a single lifecycle-integrity fabric
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician ID</CardTitle>
          <CardDescription>Enter clinician ID to view lifecycle integrity fabric</CardDescription>
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
              onClick={fetchFabric}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {fabric && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Coherence Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Lifecycle Coherence</span>
                  <Badge variant={fabric.coherence.coherent ? 'default' : 'destructive'}>
                    {fabric.coherence.coherent ? 'Coherent' : 'Mismatches Detected'}
                  </Badge>
                </div>
                {fabric.coherence.mismatches.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Mismatches:</div>
                    {fabric.coherence.mismatches.map((m, idx) => (
                      <Alert key={idx} variant="destructive">
                        <AlertDescription>
                          <div className="font-semibold">{m.segment1} → {m.segment2}</div>
                          <div className="text-sm mt-1">{m.issue}</div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {fabric.integrityBreaks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Integrity Breaks</CardTitle>
                <CardDescription>Detected lifecycle integrity issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fabric.integrityBreaks.map((breakItem, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={
                          breakItem.severity === 'severe' ? 'destructive' :
                          breakItem.severity === 'moderate' ? 'default' : 'outline'
                        }>
                          {breakItem.severity}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{breakItem.type}</span>
                      </div>
                      <div className="text-sm">{breakItem.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {fabric.recoverySuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recovery Suggestions</CardTitle>
                <CardDescription>Recommended actions to restore integrity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {fabric.recoverySuggestions.map((suggestion, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <Badge>{suggestion.action}</Badge>
                        <Badge variant={
                          suggestion.priority === 'high' ? 'destructive' :
                          suggestion.priority === 'medium' ? 'default' : 'outline'
                        }>
                          {suggestion.priority}
                        </Badge>
                      </div>
                      <div className="text-sm">{suggestion.description}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Drift Forecast</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span>Predicted Decay</span>
                  <Badge>{fabric.driftForecast.predictedDecay}%</Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  Timeframe: {fabric.driftForecast.timeframe}
                </div>
                {fabric.driftForecast.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <ul className="list-disc list-inside text-sm space-y-1">
                      {fabric.driftForecast.factors.map((factor, idx) => (
                        <li key={idx}>{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








