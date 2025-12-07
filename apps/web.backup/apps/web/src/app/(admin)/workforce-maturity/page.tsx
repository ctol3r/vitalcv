'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface MaturityModel {
  orgId: string;
  signals: {
    atsDepth: number;
    complianceAutomation: number;
    verificationQuality: number;
    retentionHistory: number;
    safetyTrackRecord: number;
  };
  score: number;
  stage: string;
  drift?: {
    detected: boolean;
    regression: number;
  };
  recommendations: Array<{
    area: string;
    action: string;
    impact: number;
  }>;
}

export default function WorkforceMaturityPage() {
  const [model, setModel] = useState<MaturityModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState('');

  const fetchModel = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/workforce-maturity/${orgId}`);
      const data = await res.json();
      setModel(data);
    } catch (error) {
      console.error('Failed to fetch maturity model:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'Predictive':
        return 'bg-green-500';
      case 'Intelligent':
        return 'bg-blue-500';
      case 'Optimized':
        return 'bg-yellow-500';
      case 'Base-line':
        return 'bg-orange-500';
      default:
        return 'bg-red-500';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Workforce Maturity Model</h1>
        <p className="text-muted-foreground mt-2">
          Score how sophisticated, efficient, compliant, and stable an employer's workforce machinery is
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization ID</CardTitle>
          <CardDescription>Enter organization ID to compute maturity model</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              placeholder="Enter organization ID"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchModel}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Compute
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {model && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Maturity Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span>Overall Score</span>
                    <Badge className={getStageColor(model.stage)}>
                      {model.score}/100 - {model.stage}
                    </Badge>
                  </div>
                  <Progress value={model.score} className="h-3" />
                </div>
                {model.drift?.detected && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="font-semibold text-yellow-800">Drift Detected</div>
                    <div className="text-sm text-yellow-700">
                      Regression: {model.drift.regression.toFixed(1)} points
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signals</CardTitle>
              <CardDescription>Maturity signals contributing to score</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(model.signals).map(([key, value]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <Badge variant="outline">{(value * 100).toFixed(0)}%</Badge>
                    </div>
                    <Progress value={value * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {model.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
                <CardDescription>Suggested improvements</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {model.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-3 border rounded-md">
                      <div className="font-semibold">{rec.area}</div>
                      <div className="text-sm text-muted-foreground mt-1">{rec.action}</div>
                      <div className="mt-2">
                        <Badge variant="outline">Impact: {(rec.impact * 100).toFixed(0)}%</Badge>
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

