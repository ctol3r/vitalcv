'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface RiskHardeningMatrix {
  clinicianId: string;
  chainHealth: {
    blockTime: number;
    anchorGaps: number;
    validationDrift: number;
    orphanBlocks: number;
  };
  riskMapping: {
    chainIssues: number;
    credentialIntegrity: number;
    issuerTrust: number;
    overallRisk: number;
  };
  stabilization: Array<{
    action: string;
    priority: number;
    impact: number;
  }>;
  trajectory?: {
    predicted: boolean;
    riskChange: number;
    timeframe: string;
  };
  interventions?: Array<{
    action: string;
    outcome: string;
    timestamp: string;
  }>;
}

export default function RiskHardeningPage() {
  const [matrix, setMatrix] = useState<RiskHardeningMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('');

  const fetchMatrix = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/risk-hardening/${clinicianId}`);
      const data = await res.json();
      setMatrix(data);
    } catch (error) {
      console.error('Failed to fetch risk hardening matrix:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chain-Integrated Risk Hardening Matrix</h1>
        <p className="text-muted-foreground mt-2">
          Fully integrate risk analysis with chain health, anchor reliability & issuer identities
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician ID</CardTitle>
          <CardDescription>Enter clinician ID to compute risk hardening matrix</CardDescription>
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
              onClick={fetchMatrix}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Compute
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {matrix && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Overall Risk Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Overall Risk</span>
                    <Badge variant={matrix.riskMapping.overallRisk > 0.7 ? 'destructive' : 'outline'}>
                      {(matrix.riskMapping.overallRisk * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={matrix.riskMapping.overallRisk * 100} className="h-3" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk Components</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span>Chain Issues</span>
                    <Badge variant="outline">
                      {(matrix.riskMapping.chainIssues * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={matrix.riskMapping.chainIssues * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span>Credential Integrity</span>
                    <Badge variant="outline">
                      {(matrix.riskMapping.credentialIntegrity * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={matrix.riskMapping.credentialIntegrity * 100} className="h-2" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span>Issuer Trust</span>
                    <Badge variant="outline">
                      {(matrix.riskMapping.issuerTrust * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <Progress value={matrix.riskMapping.issuerTrust * 100} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Chain Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Block Time</div>
                  <div className="text-lg font-semibold">{matrix.chainHealth.blockTime}ms</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Anchor Gaps</div>
                  <div className="text-lg font-semibold">{matrix.chainHealth.anchorGaps}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Validation Drift</div>
                  <div className="text-lg font-semibold">
                    {(matrix.chainHealth.validationDrift * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Orphan Blocks</div>
                  <div className="text-lg font-semibold">{matrix.chainHealth.orphanBlocks}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {matrix.stabilization.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Stabilization Actions</CardTitle>
                <CardDescription>Recommended hardening actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {matrix.stabilization.map((action, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{action.action}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">Priority: {action.priority}</Badge>
                        <Badge variant="outline">Impact: {(action.impact * 100).toFixed(0)}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {matrix.trajectory?.predicted && (
            <Card>
              <CardHeader>
                <CardTitle>Risk Trajectory</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <span className="font-semibold">Predicted Change: </span>
                    {(matrix.trajectory.riskChange * 100).toFixed(1)}% over {matrix.trajectory.timeframe}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {matrix.interventions && matrix.interventions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Intervention History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {matrix.interventions.map((intervention, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{intervention.action}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        Outcome: {intervention.outcome}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(intervention.timestamp).toLocaleString()}
                      </div>
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

