'use client';

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Download,
  Play,
  Save,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface ScenarioTemplate {
  id: string;
  name: string;
  description: string;
}

interface SimulationOutput {
  projectedTrustScore7: number;
  projectedTrustScore30: number;
  projectedTrustScore90: number;
  riskLevel: string;
  riskScore: number;
  scenarioSnapshots: Array<{
    day: number;
    trustScore: number;
    riskScore: number;
    riskLevel: string;
    activeFactors: Array<{
      type: string;
      severity: string;
      description: string;
    }>;
  }>;
  keyRiskDrivers: Array<{
    driver: string;
    impact: number;
    timeline: string;
    description: string;
  }>;
  mitigationRecommendations: Array<{
    action: string;
    priority: 'urgent' | 'high' | 'medium' | 'low';
    description: string;
    expectedImpact: number;
  }>;
}

interface SimulationResult {
  simulation: {
    id: string;
    baselineTrustScore: number;
    projectedTrustScore7: number;
    projectedTrustScore30: number;
    projectedTrustScore90: number;
    riskLevel: string;
    riskScore: number;
  };
  output: SimulationOutput;
  explanation?: {
    summary: string;
    reasoning: string;
    keyInsights: string[];
    recommendations: string[];
  };
}

export default function RiskSimulationPage() {
  const [loading, setLoading] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [scenarios, setScenarios] = useState<ScenarioTemplate[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('baseline');
  const [baselineResult, setBaselineResult] = useState<SimulationResult | null>(null);
  const [scenarioResult, setScenarioResult] = useState<SimulationResult | null>(null);
  const [allScenariosResult, setAllScenariosResult] = useState<Record<string, any> | null>(null);
  const [clinicianId, setClinicianId] = useState<string>('');

  // Load scenario templates
  useEffect(() => {
    const loadScenarios = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/risk/simulate/scenarios/templates`);
        const data = await res.json();
        if (data.ok) {
          setScenarios(data.scenarios);
        }
      } catch (error) {
        console.error('Failed to load scenarios:', error);
      }
    };
    loadScenarios();
  }, []);

  // Run baseline simulation
  const runBaseline = useCallback(async () => {
    if (!clinicianId) {
      alert('Please enter a clinician ID');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk/simulate/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId }),
      });
      const data = await res.json();
      if (data.ok) {
        setBaselineResult(data);
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch (error) {
      console.error('Baseline simulation error:', error);
      alert('Failed to run baseline simulation');
    } finally {
      setLoading(false);
    }
  }, [clinicianId]);

  // Run scenario simulation
  const runScenario = useCallback(async () => {
    if (!clinicianId) {
      alert('Please enter a clinician ID');
      return;
    }

    if (selectedScenario === 'baseline') {
      runBaseline();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk/simulate/scenario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId, scenario: selectedScenario }),
      });
      const data = await res.json();
      if (data.ok) {
        setScenarioResult(data);
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch (error) {
      console.error('Scenario simulation error:', error);
      alert('Failed to run scenario simulation');
    } finally {
      setLoading(false);
    }
  }, [clinicianId, selectedScenario, runBaseline]);

  // Run all scenarios
  const runAllScenarios = useCallback(async () => {
    if (!clinicianId) {
      alert('Please enter a clinician ID');
      return;
    }

    setSimulating(true);
    try {
      const res = await fetch(`${API_BASE}/api/risk/simulate/all-scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId }),
      });
      const data = await res.json();
      if (data.ok) {
        setAllScenariosResult(data.results);
      } else {
        alert(data.error || 'Simulation failed');
      }
    } catch (error) {
      console.error('All scenarios simulation error:', error);
      alert('Failed to run all scenarios');
    } finally {
      setSimulating(false);
    }
  }, [clinicianId]);

  // Save simulation
  const saveSimulation = useCallback(async (simulationId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/risk/simulate/${simulationId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.ok) {
        alert('Simulation saved for audit');
      } else {
        alert(data.error || 'Failed to save simulation');
      }
    } catch (error) {
      console.error('Save simulation error:', error);
      alert('Failed to save simulation');
    }
  }, []);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'High':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Elevated':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'high':
        return 'bg-orange-100 text-orange-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Credential Risk Simulation Engine</h1>
        <p className="text-muted-foreground">
          Predictive · Stochastic · Trust-weighted · Chain-aware · Operational
        </p>
      </div>

      {/* Input Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Simulation Configuration</CardTitle>
          <CardDescription>Configure and run risk simulations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Clinician ID / NPI</label>
              <input
                type="text"
                value={clinicianId}
                onChange={(e) => setClinicianId(e.target.value)}
                placeholder="Enter clinician ID or NPI"
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Scenario</label>
              <Select value={selectedScenario} onValueChange={setSelectedScenario}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scenario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="baseline">Baseline (Current State)</SelectItem>
                  {scenarios.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={runScenario} disabled={loading || !clinicianId}>
              <Play className="w-4 h-4 mr-2" />
              {loading ? 'Running...' : 'Run Simulation'}
            </Button>
            <Button onClick={runAllScenarios} disabled={simulating || !clinicianId} variant="outline">
              <Zap className="w-4 h-4 mr-2" />
              {simulating ? 'Simulating All...' : 'Simulate All Scenarios'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      {baselineResult && (
        <Tabs defaultValue="baseline" className="space-y-6">
          <TabsList>
            <TabsTrigger value="baseline">Baseline Simulation</TabsTrigger>
            {scenarioResult && <TabsTrigger value="scenario">Scenario Comparison</TabsTrigger>}
            {allScenariosResult && <TabsTrigger value="all">All Scenarios</TabsTrigger>}
            <TabsTrigger value="drivers">Risk Drivers</TabsTrigger>
            <TabsTrigger value="recommendations">Mitigation</TabsTrigger>
          </TabsList>

          <TabsContent value="baseline" className="space-y-6">
            {/* Trust Score Forecast */}
            <Card>
              <CardHeader>
                <CardTitle>Trust Score Forecast</CardTitle>
                <CardDescription>Projected trust score over 7, 30, and 90 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      {(baselineResult.output.projectedTrustScore7 * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">7 Days</div>
                    {baselineResult.simulation.baselineTrustScore && (
                      <div className="text-xs mt-1">
                        {baselineResult.output.projectedTrustScore7 >= baselineResult.simulation.baselineTrustScore ? (
                          <span className="text-green-600 flex items-center justify-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +{((baselineResult.output.projectedTrustScore7 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {((baselineResult.output.projectedTrustScore7 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      {(baselineResult.output.projectedTrustScore30 * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">30 Days</div>
                    {baselineResult.simulation.baselineTrustScore && (
                      <div className="text-xs mt-1">
                        {baselineResult.output.projectedTrustScore30 >= baselineResult.simulation.baselineTrustScore ? (
                          <span className="text-green-600 flex items-center justify-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +{((baselineResult.output.projectedTrustScore30 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {((baselineResult.output.projectedTrustScore30 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold mb-2">
                      {(baselineResult.output.projectedTrustScore90 * 100).toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">90 Days</div>
                    {baselineResult.simulation.baselineTrustScore && (
                      <div className="text-xs mt-1">
                        {baselineResult.output.projectedTrustScore90 >= baselineResult.simulation.baselineTrustScore ? (
                          <span className="text-green-600 flex items-center justify-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +{((baselineResult.output.projectedTrustScore90 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center justify-center gap-1">
                            <TrendingDown className="w-3 h-3" /> {((baselineResult.output.projectedTrustScore90 - baselineResult.simulation.baselineTrustScore) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Gradient Meter */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Level</CardTitle>
                <CardDescription>Current and projected risk assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Risk Score</span>
                      <span className="text-sm font-bold">{baselineResult.simulation.riskScore.toFixed(1)}</span>
                    </div>
                    <Progress value={baselineResult.simulation.riskScore} className="h-3" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('px-3 py-1', getRiskColor(baselineResult.output.riskLevel))}>
                      {baselineResult.output.riskLevel}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Baseline: {(baselineResult.simulation.baselineTrustScore * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Explanation */}
            {baselineResult.explanation && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    AI Explanation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">{baselineResult.explanation.summary}</p>
                  <p className="text-sm text-muted-foreground">{baselineResult.explanation.reasoning}</p>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Key Insights</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {baselineResult.explanation.keyInsights.map((insight, i) => (
                        <li key={i}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <Button onClick={() => saveSimulation(baselineResult.simulation.id)} variant="outline">
                <Save className="w-4 h-4 mr-2" />
                Save for Audit
              </Button>
            </div>
          </TabsContent>

          {scenarioResult && (
            <TabsContent value="scenario" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Scenario Comparison</CardTitle>
                  <CardDescription>Baseline vs Scenario Simulation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Baseline</h4>
                      <div className="space-y-2 text-sm">
                        <div>Trust Score (90d): {(baselineResult.output.projectedTrustScore90 * 100).toFixed(1)}%</div>
                        <div>Risk Level: <Badge className={getRiskColor(baselineResult.output.riskLevel)}>{baselineResult.output.riskLevel}</Badge></div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Scenario</h4>
                      <div className="space-y-2 text-sm">
                        <div>Trust Score (90d): {(scenarioResult.output.projectedTrustScore90 * 100).toFixed(1)}%</div>
                        <div>Risk Level: <Badge className={getRiskColor(scenarioResult.output.riskLevel)}>{scenarioResult.output.riskLevel}</Badge></div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {allScenariosResult && (
            <TabsContent value="all" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>All Scenarios Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(allScenariosResult).map(([scenario, result]: [string, any]) => (
                      <div key={scenario} className="border rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium">{scenario}</h4>
                          {result.riskLevel && (
                            <Badge className={getRiskColor(result.riskLevel)}>{result.riskLevel}</Badge>
                          )}
                        </div>
                        {result.projectedTrustScore90 && (
                          <div className="text-sm text-muted-foreground mt-2">
                            Trust Score (90d): {(result.projectedTrustScore90 * 100).toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="drivers" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Risk Drivers</CardTitle>
                <CardDescription>Primary factors affecting trust score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {baselineResult.output.keyRiskDrivers.map((driver, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{driver.driver}</h4>
                        <Badge variant="outline">{(driver.impact * 100).toFixed(0)}% Impact</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{driver.description}</p>
                      <div className="text-xs text-muted-foreground">Timeline: {driver.timeline}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Mitigation Recommendations</CardTitle>
                <CardDescription>Actions to reduce risk and improve trust score</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {baselineResult.output.mitigationRecommendations.map((rec, i) => (
                    <div key={i} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{rec.action}</h4>
                        <Badge className={getPriorityColor(rec.priority)}>{rec.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                      <div className="text-xs text-muted-foreground">
                        Expected Impact: {(rec.expectedImpact * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

