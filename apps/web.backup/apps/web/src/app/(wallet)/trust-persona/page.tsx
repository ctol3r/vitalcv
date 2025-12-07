'use client';

import { useCallback, useEffect, useState } from 'react';
import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

export default function TrustPersonaPage() {
  const { formatError } = useRoleUX();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/trust/persona`);
      if (!response.ok) {
        throw new Error(`Trust persona API failed (${response.status})`);
      }
      const payload = await response.json();
      setPersona(payload);
    } catch (err) {
      console.error('[wallet][trust-persona] load failed', err);
      setError(formatError('persona_fetch_failed', err instanceof Error ? err.message : 'Unable to load persona'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Trust Persona</CardTitle>
            <CardDescription>Loading trust data...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Trust Persona</CardTitle>
            <CardDescription className="text-destructive">{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const overallScore = persona?.overallScore || 0;
  const dimensions = persona?.dimensions || {};

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Clinician Trust Persona Engine v4
          </CardTitle>
          <CardDescription>
            Dynamic, multi-dimensional trust persona built from behavior, credential integrity & performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Trust Score</span>
                <span className="text-2xl font-bold">{Math.round(overallScore * 100)}%</span>
              </div>
              <Progress value={overallScore * 100} className="h-3" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Behavioral</div>
                <div className="text-lg font-semibold">{Math.round((dimensions.behavioral || 0) * 100)}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Credential</div>
                <div className="text-lg font-semibold">{Math.round((dimensions.credential || 0) * 100)}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Interpersonal</div>
                <div className="text-lg font-semibold">{Math.round((dimensions.interpersonal || 0) * 100)}%</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Performance</div>
                <div className="text-lg font-semibold">{Math.round((dimensions.performance || 0) * 100)}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {persona?.anomalies && persona.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Trust Anomalies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {persona.anomalies.map((anomaly: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <Badge variant={anomaly.severity === 'high' ? 'destructive' : 'secondary'}>
                    {anomaly.severity}
                  </Badge>
                  <div className="text-sm">{anomaly.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

