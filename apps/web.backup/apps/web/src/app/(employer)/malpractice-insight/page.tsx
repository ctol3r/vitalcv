'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown, Shield, MapPin, Briefcase } from 'lucide-react';

interface MalpracticeSignal {
  signalType: string;
  strength: number;
  metadata: Record<string, any>;
  detectedAt: string;
}

interface LiabilityRiskScore {
  clinicianId: string;
  overallRiskScore: number;
  components: {
    sanctionFrequency: number;
    specialtyBaseRate: number;
    locationLitigation: number;
    transitionRisk?: number;
    renewalReliability: number;
  };
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  recommendations: string[];
  calculatedAt: string;
}

interface LegalEnvironment {
  state: string;
  overallIndex: number;
  components: {
    damageCaps: number;
    statuteOfLimitations: number;
    jointLiability: number;
    expertWitnessRequirements: number;
    precedentTrend: number;
  };
  riskLevel: string;
  description: string;
}

interface EmployerImpact {
  facilityId: string;
  clinicianId: string;
  expectedLiabilityCost: number;
  components: {
    clinicianBaseRisk: number;
    facilityRiskMultiplier: number;
    legalEnvironmentFactor: number;
    specialtyRiskFactor: number;
  };
  riskCategory: string;
  recommendations: string[];
}

export default function MalpracticeInsightPage() {
  const [clinicianId, setClinicianId] = useState<string>('');
  const [riskScore, setRiskScore] = useState<LiabilityRiskScore | null>(null);
  const [signals, setSignals] = useState<MalpracticeSignal[]>([]);
  const [legalEnv, setLegalEnv] = useState<LegalEnvironment | null>(null);
  const [employerImpact, setEmployerImpact] = useState<EmployerImpact | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRiskScore = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/malpractice/risk-score/${clinicianId}`);
      const data = await res.json();
      setRiskScore(data);
    } catch (error) {
      console.error('Failed to fetch risk score', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSignals = async () => {
    if (!clinicianId) return;
    try {
      const res = await fetch(`/api/malpractice/signals/${clinicianId}`);
      const data = await res.json();
      setSignals(data.signals || []);
    } catch (error) {
      console.error('Failed to fetch signals', error);
    }
  };

  const fetchLegalEnvironment = async (state: string) => {
    try {
      const res = await fetch(`/api/malpractice/legal-environment?state=${state}`);
      const data = await res.json();
      setLegalEnv(data);
    } catch (error) {
      console.error('Failed to fetch legal environment', error);
    }
  };

  const calculateEmployerImpact = async (facilityId: string) => {
    if (!clinicianId || !facilityId) return;
    try {
      const res = await fetch('/api/malpractice/employer-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, clinicianId }),
      });
      const data = await res.json();
      setEmployerImpact(data);
    } catch (error) {
      console.error('Failed to calculate employer impact', error);
    }
  };

  useEffect(() => {
    if (clinicianId) {
      fetchRiskScore();
      fetchSignals();
    }
  }, [clinicianId]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'destructive';
      case 'high':
        return 'secondary';
      case 'moderate':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Malpractice Insight Dashboard</h1>
        <p className="text-muted-foreground">
          Analyze liability exposure, risk vectors, state litigation environments, and NPDB evolution
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clinician Analysis</CardTitle>
          <CardDescription>Enter clinician ID to analyze malpractice risk</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <Button onClick={fetchRiskScore} disabled={loading || !clinicianId}>
              Analyze
            </Button>
          </div>
        </CardContent>
      </Card>

      {riskScore && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Liability Risk Score
              </CardTitle>
              <CardDescription>Overall risk assessment: {riskScore.overallRiskScore}/100</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl font-bold">{riskScore.overallRiskScore}</div>
                <Badge variant={getRiskColor(riskScore.riskLevel)}>
                  {riskScore.riskLevel.toUpperCase()}
                </Badge>
              </div>
              <Progress value={riskScore.overallRiskScore} className="h-3" />

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Sanction Frequency</p>
                  <p className="text-2xl font-semibold">{riskScore.components.sanctionFrequency}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Specialty Base Rate</p>
                  <p className="text-2xl font-semibold">{riskScore.components.specialtyBaseRate}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Location Litigation</p>
                  <p className="text-2xl font-semibold">{riskScore.components.locationLitigation}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Renewal Reliability</p>
                  <p className="text-2xl font-semibold">{riskScore.components.renewalReliability}</p>
                </div>
                {riskScore.components.transitionRisk !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Transition Risk</p>
                    <p className="text-2xl font-semibold">{riskScore.components.transitionRisk}</p>
                  </div>
                )}
              </div>

              {riskScore.recommendations.length > 0 && (
                <div className="mt-6">
                  <p className="font-semibold mb-2">Recommendations</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {riskScore.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Malpractice Signals</CardTitle>
              <CardDescription>Detected risk indicators (no PHI used)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {signals.map((signal, i) => (
                  <div key={i} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">{signal.signalType}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Strength:</span>
                        <span className="font-semibold">{(signal.strength * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <Progress value={signal.strength * 100} className="h-2" />
                    <div className="mt-2 text-xs text-muted-foreground">
                      Detected: {new Date(signal.detectedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {signals.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No signals detected</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Legal Environment Index
          </CardTitle>
          <CardDescription>State-specific litigation environment analysis</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="State (e.g., CA, NY)"
              className="flex-1 px-3 py-2 border rounded-md"
              onBlur={(e) => {
                if (e.target.value) fetchLegalEnvironment(e.target.value);
              }}
            />
          </div>

          {legalEnv && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{legalEnv.overallIndex}</div>
                <Badge variant={getRiskColor(legalEnv.riskLevel)}>
                  {legalEnv.riskLevel.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{legalEnv.description}</p>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Damage Caps</p>
                  <p className="text-lg font-semibold">{legalEnv.components.damageCaps}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Statute of Limitations</p>
                  <p className="text-lg font-semibold">{legalEnv.components.statuteOfLimitations}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joint Liability</p>
                  <p className="text-lg font-semibold">{legalEnv.components.jointLiability}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expert Requirements</p>
                  <p className="text-lg font-semibold">{legalEnv.components.expertWitnessRequirements}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Precedent Trend</p>
                  <p className="text-lg font-semibold">{legalEnv.components.precedentTrend}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Employer Liability Impact
          </CardTitle>
          <CardDescription>Calculate expected liability cost for hiring decision</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Facility ID"
              className="flex-1 px-3 py-2 border rounded-md"
              onBlur={(e) => {
                if (e.target.value && clinicianId) {
                  calculateEmployerImpact(e.target.value);
                }
              }}
            />
          </div>

          {employerImpact && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Expected Annual Cost</p>
                  <p className="text-3xl font-bold">${employerImpact.expectedLiabilityCost.toLocaleString()}</p>
                </div>
                <Badge variant={getRiskColor(employerImpact.riskCategory)}>
                  {employerImpact.riskCategory.toUpperCase()}
                </Badge>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Clinician Base Risk</p>
                  <p className="text-lg font-semibold">{employerImpact.components.clinicianBaseRisk}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Facility Multiplier</p>
                  <p className="text-lg font-semibold">{employerImpact.components.facilityRiskMultiplier.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Legal Environment</p>
                  <p className="text-lg font-semibold">{employerImpact.components.legalEnvironmentFactor.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Specialty Factor</p>
                  <p className="text-lg font-semibold">{employerImpact.components.specialtyRiskFactor.toFixed(2)}x</p>
                </div>
              </div>

              {employerImpact.recommendations.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Recommendations</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {employerImpact.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

