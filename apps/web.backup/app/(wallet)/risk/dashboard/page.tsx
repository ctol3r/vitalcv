'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, TrendingUp, TrendingDown, AlertTriangle, DollarSign, Users } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface RiskPrimitive {
  type: string;
  value: number;
  confidence: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

interface WorkforceRiskPortfolio {
  orgId: string;
  exposureIndex: number;
  primitives: {
    sanctionRisk: number;
    renewalRisk: number;
    burnoutRisk: number;
    privilegeRisk: number;
    deaComplianceRisk: number;
  };
  diversification: {
    bySpecialty: Record<string, number>;
    byRole: Record<string, number>;
  };
  concentrationRisk: number;
  lastUpdated: string;
}

interface PremiumIncentive {
  clinicianId: string;
  retentionBonus: number;
  signingIncentive: number;
  credentialCompletionIncentive: number;
  riskAdjustedCompensation: number;
  rationale: string[];
}

export default function RiskMarketsDashboardPage() {
  const [orgId, setOrgId] = useState('org-123');
  const [portfolio, setPortfolio] = useState<WorkforceRiskPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPortfolio();
    const interval = setInterval(fetchPortfolio, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [orgId]);

  const fetchPortfolio = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/risk-derivatives/portfolio/${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const data = await res.json();
      setPortfolio(data);
    } catch (error) {
      console.error('Error fetching portfolio:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskLevel = (index: number) => {
    if (index < 30) return { label: 'Low Risk', color: 'bg-green-500', variant: 'default' as const };
    if (index < 60) return { label: 'Moderate Risk', color: 'bg-yellow-500', variant: 'secondary' as const };
    if (index < 80) return { label: 'High Risk', color: 'bg-orange-500', variant: 'destructive' as const };
    return { label: 'Critical Risk', color: 'bg-red-500', variant: 'destructive' as const };
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>No portfolio data available for {orgId}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const riskLevel = getRiskLevel(portfolio.exposureIndex);
  const primitives: RiskPrimitive[] = [
    { type: 'Sanction Risk', value: portfolio.primitives.sanctionRisk, confidence: 0.8, trend: 'stable' },
    { type: 'Renewal Risk', value: portfolio.primitives.renewalRisk, confidence: 0.85, trend: 'stable' },
    { type: 'Burnout Risk', value: portfolio.primitives.burnoutRisk, confidence: 0.75, trend: 'increasing' },
    { type: 'Privilege Risk', value: portfolio.primitives.privilegeRisk, confidence: 0.8, trend: 'stable' },
    { type: 'DEA Compliance Risk', value: portfolio.primitives.deaComplianceRisk, confidence: 0.85, trend: 'stable' },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Risk Markets Dashboard</h1>
          <p className="text-muted-foreground">Workforce risk portfolio analysis</p>
        </div>
        <Badge variant={riskLevel.variant}>{riskLevel.label}</Badge>
      </div>

      {/* Exposure Index */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Workforce Risk Exposure Index
          </CardTitle>
          <CardDescription>Aggregate risk score: {portfolio.exposureIndex}/100</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Exposure</span>
                <span className="text-2xl font-bold">{portfolio.exposureIndex}/100</span>
              </div>
              <Progress value={portfolio.exposureIndex} className="h-3" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">Concentration Risk</div>
                <div className="text-2xl font-bold">{Math.round(portfolio.concentrationRisk * 100)}%</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {portfolio.concentrationRisk > 0.7 ? 'High concentration' : 'Well diversified'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <div className="text-sm font-medium">
                  {new Date(portfolio.lastUpdated).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk Primitives */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Primitives</CardTitle>
          <CardDescription>Individual risk factor breakdown</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {primitives.map((primitive) => (
              <div key={primitive.type}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{primitive.type}</span>
                    {primitive.trend === 'increasing' && (
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                    )}
                    {primitive.trend === 'decreasing' && (
                      <TrendingDown className="h-4 w-4 text-green-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{Math.round(primitive.value * 100)}%</span>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(primitive.confidence * 100)}% conf
                    </Badge>
                  </div>
                </div>
                <Progress value={primitive.value * 100} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Diversification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Diversification Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.keys(portfolio.diversification.bySpecialty).length > 0 && (
              <div>
                <div className="font-semibold mb-2">By Specialty</div>
                <div className="space-y-2">
                  {Object.entries(portfolio.diversification.bySpecialty).map(([specialty, risk]) => (
                    <div key={specialty} className="flex items-center justify-between">
                      <span className="text-sm">{specialty}</span>
                      <Badge variant="outline">{Math.round(risk * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(portfolio.diversification.byRole).length > 0 && (
              <div>
                <div className="font-semibold mb-2">By Role</div>
                <div className="space-y-2">
                  {Object.entries(portfolio.diversification.byRole).map(([role, risk]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="text-sm">{role}</span>
                      <Badge variant="outline">{Math.round(risk * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Recommended Interventions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {portfolio.exposureIndex > 60 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  High exposure detected. Consider proactive risk mitigation strategies.
                </AlertDescription>
              </Alert>
            )}
            {portfolio.primitives.renewalRisk > 0.5 && (
              <div className="p-3 border rounded-lg">
                <div className="font-semibold">Renewal Risk Mitigation</div>
                <div className="text-sm text-muted-foreground">
                  Implement proactive renewal reminders and CME tracking
                </div>
              </div>
            )}
            {portfolio.primitives.burnoutRisk > 0.6 && (
              <div className="p-3 border rounded-lg">
                <div className="font-semibold">Burnout Prevention</div>
                <div className="text-sm text-muted-foreground">
                  Review workload distribution and consider retention bonuses
                </div>
              </div>
            )}
            {portfolio.concentrationRisk > 0.7 && (
              <div className="p-3 border rounded-lg">
                <div className="font-semibold">Diversification</div>
                <div className="text-sm text-muted-foreground">
                  High concentration risk. Consider diversifying across specialties and roles.
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

