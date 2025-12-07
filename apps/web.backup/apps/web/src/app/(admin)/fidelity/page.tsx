'use client';

import { AlertCircle, Anchor, Download, RefreshCw, Shield } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface FidelityTensorData {
  orgId: string;
  dimensions: {
    PrivilegeIntegrity: number;
    Fairness: number;
    ContractEthics: number;
    VerificationReliability: number;
    SafetyCultureAlignment: number;
    RegulatoryCooperation: number;
    BurnoutPropagation: number;
    ATSBehaviorQuality: number;
    BiasCorrection: number;
    BiasDetection: number;
    FairnessVolatility: number;
    RegulatoryFidelity: number;
    NCQAAlignment: number;
    JCAlignment: number;
    CMSAlignment: number;
    ComplianceVolatility: number;
    MultiSiteHarmony: number;
    SiteConsistency: number;
    CrossSiteAlignment: number;
    PerformanceFidelity: number;
    OutcomeAlignment: number;
    ClinicianOutcomeLink: number;
    EthicalSaturation: number;
    ContractBehaviorCoherence: number;
    NegativeFidelity: number;
    BurnoutCausality: number;
    PolicyBurnoutImpact: number;
    GlobalPositioning: number;
    RegionalRanking: number;
    Overall: number;
  };
  metadata: {
    computedAt: string;
    version: string;
    algorithm: string;
  };
  anomalies?: Array<{
    dimension: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suggestedAction: string;
  }>;
  predictions?: {
    fidelityForecast: number;
    driftRisk: number;
    trajectory: Array<{ date: string; score: number }>;
  };
}

export default function FidelityPage() {
  const [orgId, setOrgId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FidelityTensorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchFidelity = async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/fidelity/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch fidelity data');
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const exportPack = async () => {
    if (!orgId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/api/fidelity/${orgId}/export`);
      if (!res.ok) throw new Error('Failed to export fidelity pack');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fidelity-${orgId}.json`;
      a.click();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const anchorSnapshot = async () => {
    if (!orgId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/fidelity/${orgId}/anchor`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to anchor snapshot');
      const result = await res.json();
      alert(`Snapshot anchored: ${result.digest}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const dimensionGroups = [
    {
      title: 'Core Fidelity',
      dimensions: ['PrivilegeIntegrity', 'Fairness', 'ContractEthics', 'VerificationReliability', 'SafetyCultureAlignment', 'RegulatoryCooperation', 'BurnoutPropagation', 'ATSBehaviorQuality'],
    },
    {
      title: 'Bias & Correction',
      dimensions: ['BiasCorrection', 'BiasDetection', 'FairnessVolatility'],
    },
    {
      title: 'Regulatory Compliance',
      dimensions: ['RegulatoryFidelity', 'NCQAAlignment', 'JCAlignment', 'CMSAlignment', 'ComplianceVolatility'],
    },
    {
      title: 'Multi-Site Harmony',
      dimensions: ['MultiSiteHarmony', 'SiteConsistency', 'CrossSiteAlignment'],
    },
    {
      title: 'Performance Integration',
      dimensions: ['PerformanceFidelity', 'OutcomeAlignment', 'ClinicianOutcomeLink'],
    },
    {
      title: 'Ethical & Behavioral',
      dimensions: ['EthicalSaturation', 'ContractBehaviorCoherence', 'NegativeFidelity'],
    },
    {
      title: 'Burnout & Causality',
      dimensions: ['BurnoutCausality', 'PolicyBurnoutImpact'],
    },
    {
      title: 'Global Positioning',
      dimensions: ['GlobalPositioning', 'RegionalRanking'],
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Employer Trust Fidelity Engine
          </h1>
          <p className="text-muted-foreground mt-2">
            A 30-axis fidelity engine measuring how faithfully an employer behaves according to safety, fairness, trust, compliance & consistency
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fidelity Tensor Analysis</CardTitle>
          <CardDescription>Enter an organization ID to view trust fidelity metrics</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Organization ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchFidelity()}
            />
            <Button onClick={fetchFidelity} disabled={loading || !orgId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
            {data && (
              <>
                <Button onClick={exportPack} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button onClick={anchorSnapshot} variant="outline" disabled={loading}>
                  <Anchor className="h-4 w-4 mr-2" />
                  Anchor
                </Button>
              </>
            )}
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {loading && !data && <Skeleton className="h-64 w-full" />}

          {data && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Overall Fidelity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">{(data.dimensions.Overall * 100).toFixed(1)}%</div>
                      <Progress value={data.dimensions.Overall * 100} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Fidelity Forecast</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="text-3xl font-bold">
                        {data.predictions ? (data.predictions.fidelityForecast * 100).toFixed(1) : 'N/A'}%
                      </div>
                      <Badge variant={data.predictions?.driftRisk && data.predictions.driftRisk < 0.3 ? 'default' : 'destructive'}>
                        Drift Risk: {data.predictions ? (data.predictions.driftRisk * 100).toFixed(1) : 'N/A'}%
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Computed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      {new Date(data.metadata.computedAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      v{data.metadata.version} • {data.metadata.algorithm}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {data.anomalies && data.anomalies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Anomalies Detected</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {data.anomalies.map((anomaly, i) => (
                        <div key={i} className="p-3 border rounded">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{anomaly.dimension}</span>
                            <Badge variant={anomaly.severity === 'high' ? 'destructive' : anomaly.severity === 'medium' ? 'default' : 'secondary'}>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">{anomaly.description}</div>
                          <div className="text-sm text-muted-foreground mt-1">
                            <strong>Action:</strong> {anomaly.suggestedAction}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {dimensionGroups.map((group) => (
                <Card key={group.title}>
                  <CardHeader>
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {group.dimensions.map((dim) => {
                        const value = data.dimensions[dim as keyof typeof data.dimensions];
                        return (
                          <div key={dim} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{dim}</span>
                              <span className="font-semibold">{(value * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={value * 100} className="h-2" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

