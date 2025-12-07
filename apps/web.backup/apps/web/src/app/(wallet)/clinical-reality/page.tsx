'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ClinicalReality {
  clinicianId: string;
  reality: {
    privilegesExercised: Array<{
      privilege: string;
      frequency: number;
      lastUsed: string;
    }>;
    caseLogs: Array<{
      caseType: string;
      volume: number;
      recency: string;
    }>;
    cmeRecency: number;
  };
  coherence: Array<{
    credentialId: string;
    coherenceScore: number;
    mismatches: Array<{
      type: string;
      description: string;
    }>;
  }>;
  driftPrediction: {
    timeframe: string;
    predictedDrift: number;
    factors: string[];
  };
  suggestions: Array<{
    type: string;
    priority: string;
    description: string;
  }>;
}

export default function ClinicalRealityPage() {
  const [reality, setReality] = useState<ClinicalReality | null>(null);
  const [loading, setLoading] = useState(false);
  const [clinicianId, setClinicianId] = useState('');

  const fetchReality = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/clinical-reality/${clinicianId}`);
      const data = await res.json();
      setReality(data);
    } catch (error) {
      console.error('Failed to fetch clinical reality:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Clinical Reality Verification Engine</h1>
        <p className="text-muted-foreground mt-2">
          Verify how accurately a clinician's credential stack reflects their actual clinical reality
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician ID</CardTitle>
          <CardDescription>Enter clinician ID to view clinical reality</CardDescription>
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
              onClick={fetchReality}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {reality && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Reality Mismatch Heatmap</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {reality.coherence.map((coh, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">Credential {coh.credentialId}</span>
                      <Badge variant={coh.coherenceScore > 0.8 ? 'default' : coh.coherenceScore > 0.5 ? 'secondary' : 'destructive'}>
                        {Math.round(coh.coherenceScore * 100)}% coherence
                      </Badge>
                    </div>
                    {coh.mismatches.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {coh.mismatches.map((mismatch, mIdx) => (
                          <Alert key={mIdx} variant={mismatch.type === 'overclaim' ? 'destructive' : 'default'}>
                            <AlertDescription>
                              <Badge variant="outline" className="mr-2">{mismatch.type}</Badge>
                              {mismatch.description}
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reality Drift Prediction</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-sm font-semibold">Timeframe: {reality.driftPrediction.timeframe}</div>
                <div className="text-sm">Predicted Drift: {Math.round(reality.driftPrediction.predictedDrift * 100)}%</div>
                {reality.driftPrediction.factors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm font-semibold mb-1">Factors:</div>
                    <div className="flex flex-wrap gap-2">
                      {reality.driftPrediction.factors.map((factor, idx) => (
                        <Badge key={idx} variant="outline">{factor}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reinforcement Suggestions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reality.suggestions.map((suggestion, idx) => (
                  <Alert key={idx} variant={suggestion.priority === 'high' ? 'destructive' : 'default'}>
                    <AlertDescription>
                      <div className="flex justify-between items-start">
                        <div>
                          <Badge variant="outline" className="mr-2">{suggestion.type}</Badge>
                          <span>{suggestion.description}</span>
                        </div>
                        <Badge variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'secondary' : 'outline'}>
                          {suggestion.priority}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clinical Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-sm font-semibold mb-2">Privileges Exercised:</div>
                  <div className="space-y-1">
                    {reality.reality.privilegesExercised.map((priv, idx) => (
                      <div key={idx} className="text-sm">
                        {priv.privilege}: {priv.frequency} times (last: {new Date(priv.lastUsed).toLocaleDateString()})
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold mb-2">Case Logs:</div>
                  <div className="space-y-1">
                    {reality.reality.caseLogs.map((log, idx) => (
                      <div key={idx} className="text-sm">
                        {log.caseType}: {log.volume} cases (last: {new Date(log.recency).toLocaleDateString()})
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-sm font-semibold">CME Recency:</div>
                  <div className="text-sm">{Math.round(reality.reality.cmeRecency / 30)} months ago</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








