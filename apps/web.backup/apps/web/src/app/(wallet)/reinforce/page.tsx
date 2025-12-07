'use client';

import { useCallback, useState } from 'react';
import { Shield, AlertTriangle, TrendingUp, FileDown, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CredentialReinforcementPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [reinforcement, setReinforcement] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReinforcement = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-reinforcement/${clinicianId}`);
      if (!response.ok) {
        throw new Error(`Failed to load reinforcement (${response.status})`);
      }
      const data = await response.json();
      setReinforcement(data);
    } catch (err) {
      console.error('Failed to fetch reinforcement', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const buildReinforcement = useCallback(async () => {
    if (!clinicianId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/credential-reinforcement/${clinicianId}/build`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error(`Failed to build reinforcement (${response.status})`);
      }
      const data = await response.json();
      setReinforcement(data);
    } catch (err) {
      console.error('Failed to build reinforcement', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  const anchorSnapshot = useCallback(async () => {
    if (!clinicianId) return;
    try {
      const response = await fetch(`${API_BASE}/api/credential-reinforcement/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (!response.ok) {
        throw new Error('Failed to anchor snapshot');
      }
      alert('Reinforcement snapshot anchored successfully');
    } catch (err) {
      console.error('Failed to anchor snapshot', err);
      alert('Failed to anchor snapshot');
    }
  }, [clinicianId]);

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Credential Reinforcement</h1>
          <p className="text-muted-foreground">
            Use AI to reinforce weak or incomplete credentials with new evidence, suggestions & verification
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>View Credential Reinforcement</CardTitle>
          <CardDescription>Enter a clinician ID to view or build reinforcement analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Clinician ID"
              className="flex-1"
            />
            <Button onClick={fetchReinforcement} disabled={!clinicianId || loading}>
              View Reinforcement
            </Button>
            <Button onClick={buildReinforcement} variant="outline" disabled={!clinicianId || loading}>
              Build Analysis
            </Button>
            <Button onClick={anchorSnapshot} variant="outline" disabled={!clinicianId}>
              <FileDown className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
            </div>
          )}

          {reinforcement && !loading && (
            <div className="space-y-6">
              {reinforcement.weakEvidence && reinforcement.weakEvidence.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Weak Evidence Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reinforcement.weakEvidence.map((evidence: any, idx: number) => (
                        <Alert key={idx} variant={evidence.severity === 'high' ? 'destructive' : evidence.severity === 'medium' ? 'default' : 'secondary'}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{evidence.weakness}</AlertTitle>
                          <AlertDescription>
                            <div className="mt-2">
                              {evidence.missingFields && evidence.missingFields.length > 0 && (
                                <p className="text-sm">Missing: {evidence.missingFields.join(', ')}</p>
                              )}
                              {evidence.outdatedFields && evidence.outdatedFields.length > 0 && (
                                <p className="text-sm">Outdated: {evidence.outdatedFields.join(', ')}</p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reinforcement.suggestions && reinforcement.suggestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reinforcement Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reinforcement.suggestions.map((suggestion: any, idx: number) => (
                        <Card key={idx}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-lg">{suggestion.type}</CardTitle>
                              <Badge variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'default' : 'secondary'}>
                                {suggestion.priority}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm mb-2">{suggestion.description}</p>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm text-muted-foreground">Estimated Impact:</span>
                              <Progress value={suggestion.estimatedImpact} className="flex-1" />
                              <span className="text-sm font-medium">{suggestion.estimatedImpact}%</span>
                            </div>
                            {suggestion.steps && suggestion.steps.length > 0 && (
                              <div className="mt-2">
                                <p className="text-sm font-medium mb-1">Steps:</p>
                                <ol className="list-decimal list-inside space-y-1 text-sm">
                                  {suggestion.steps.map((step: string, stepIdx: number) => (
                                    <li key={stepIdx}>{step}</li>
                                  ))}
                                </ol>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reinforcement.warnings && reinforcement.warnings.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Proactive Warnings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {reinforcement.warnings.map((warning: any, idx: number) => (
                        <Alert key={idx} variant="warning">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{warning.warning}</AlertTitle>
                          <AlertDescription>
                            {warning.actionRequired} (Days until weakness: {warning.daysUntilWeakness})
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {reinforcement.timeline && reinforcement.timeline.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Reinforcement Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reinforcement.timeline.map((point: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-32 text-sm text-muted-foreground">
                            {new Date(point.timestamp).toLocaleDateString()}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{point.action}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">Before: {point.strengthBefore}%</span>
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              <span className="text-xs text-muted-foreground">After: {point.strengthAfter}%</span>
                              <Badge variant="outline" className="text-xs">+{point.improvement}%</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

