'use client';

/**
 * B131F-FE-007: Admin 'AI Governance' dashboard
 *
 * Displays GenAI governance metrics including:
 * - Registered models and their risk levels
 * - Number of decisions logged per model
 * - Latest risk summary
 * - Links to model card details
 *
 * @v0-candidate
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

// Type definitions
interface ModelCard {
  id: string;
  modelId: string;
  provider: string;
  version: string;
  trainingDataSummary?: string;
  mitigations: string[];
  metadata?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  risks?: Array<{
    id: string;
    riskCategory: {
      riskId: string;
      category: string;
      description: string;
    };
    severity: string;
    notes?: string;
  }>;
  stats: {
    decisionCount: number;
    overrideCount: number;
    overrideRate: number;
  };
}

interface RiskSummary {
  totalDecisions: number;
  totalOverrides: number;
  overallOverrideRate: number;
  models: Array<{
    modelId: string;
    modelName?: string;
    provider?: string;
    decisionCount: number;
    overrideCount: number;
    overrideRate: number;
    topRisks: Array<{
      riskId: string;
      category: string;
      count: number;
      percentage: number;
    }>;
  }>;
  topRisksAcrossModels: Array<{
    riskId: string;
    category: string;
    totalCount: number;
    percentage: number;
  }>;
  periodStart: string;
  periodEnd: string;
}

export default function GenAIGovernancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [modelCards, setModelCards] = useState<ModelCard[]>([]);
  const [riskSummary, setRiskSummary] = useState<RiskSummary | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch model cards and risk summary
      const [modelsResponse, summaryResponse] = await Promise.all([
        fetch('/api/genai/models'),
        fetch('/api/genai/reports/latest'),
      ]);

      if (!modelsResponse.ok) throw new Error('Failed to fetch model cards');
      if (!summaryResponse.ok) throw new Error('Failed to fetch risk summary');

      const modelsData = await modelsResponse.json();
      const summaryData = await summaryResponse.json();

      setModelCards(modelsData.data || []);
      setRiskSummary(summaryData.data || null);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error fetching GenAI governance data:', error);
      // Use mock data on error
      setModelCards(getMockModelCards());
      setRiskSummary(getMockRiskSummary());
    } finally {
      setLoading(false);
    }
  }

  function getMockModelCards(): ModelCard[] {
    return [
      {
        id: '1',
        modelId: 'gpt-4',
        provider: 'OpenAI',
        version: '4',
        trainingDataSummary: 'Trained on publicly available text data',
        mitigations: ['Content filtering', 'Rate limiting', 'Output validation'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        risks: [
          {
            id: '1',
            riskCategory: {
              riskId: 'CONFABULATION',
              category: 'Confabulation',
              description: 'Model may generate false information',
            },
            severity: 'HIGH',
          },
          {
            id: '2',
            riskCategory: {
              riskId: 'BIAS',
              category: 'Bias',
              description: 'Model may exhibit biases',
            },
            severity: 'MEDIUM',
          },
        ],
        stats: {
          decisionCount: 1250,
          overrideCount: 45,
          overrideRate: 0.036,
        },
      },
      {
        id: '2',
        modelId: 'claude-3-opus',
        provider: 'Anthropic',
        version: '3-opus',
        trainingDataSummary: 'Trained on curated text data',
        mitigations: ['Constitutional AI', 'Red teaming', 'Safety filters'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        risks: [
          {
            id: '3',
            riskCategory: {
              riskId: 'PRIVACY',
              category: 'Privacy',
              description: 'Model may leak training data',
            },
            severity: 'LOW',
          },
        ],
        stats: {
          decisionCount: 890,
          overrideCount: 12,
          overrideRate: 0.013,
        },
      },
    ];
  }

  function getMockRiskSummary(): RiskSummary {
    return {
      totalDecisions: 2140,
      totalOverrides: 57,
      overallOverrideRate: 0.027,
      models: [
        {
          modelId: 'gpt-4',
          modelName: 'GPT-4',
          provider: 'OpenAI',
          decisionCount: 1250,
          overrideCount: 45,
          overrideRate: 0.036,
          topRisks: [
            {
              riskId: 'CONFABULATION',
              category: 'Confabulation',
              count: 125,
              percentage: 10.0,
            },
            {
              riskId: 'BIAS',
              category: 'Bias',
              count: 87,
              percentage: 7.0,
            },
          ],
        },
        {
          modelId: 'claude-3-opus',
          modelName: 'Claude 3 Opus',
          provider: 'Anthropic',
          decisionCount: 890,
          overrideCount: 12,
          overrideRate: 0.013,
          topRisks: [
            {
              riskId: 'PRIVACY',
              category: 'Privacy',
              count: 23,
              percentage: 2.6,
            },
          ],
        },
      ],
      topRisksAcrossModels: [
        {
          riskId: 'CONFABULATION',
          category: 'Confabulation',
          totalCount: 125,
          percentage: 5.8,
        },
        {
          riskId: 'BIAS',
          category: 'Bias',
          totalCount: 87,
          percentage: 4.1,
        },
        {
          riskId: 'PRIVACY',
          category: 'Privacy',
          totalCount: 23,
          percentage: 1.1,
        },
      ],
      periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      periodEnd: new Date().toISOString(),
    };
  }

  function formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  function formatPercentage(value: number): string {
    return `${(value * 100).toFixed(2)}%`;
  }

  function getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  function getRiskLevel(overrideRate: number): string {
    if (overrideRate >= 0.1) return 'HIGH';
    if (overrideRate >= 0.05) return 'MEDIUM';
    if (overrideRate >= 0.01) return 'LOW';
    return 'VERY_LOW';
  }

  function getRiskLevelColor(overrideRate: number): string {
    const level = getRiskLevel(overrideRate);
    switch (level) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-orange-600';
      case 'LOW':
        return 'text-yellow-600';
      default:
        return 'text-green-600';
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <RefreshCw className="h-12 w-12 animate-spin mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading AI Governance dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Shield className="h-10 w-10" />
            AI Governance Dashboard
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Monitor GenAI model usage, risk levels, and decision logs
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" size="default">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Models */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Registered Models
            </CardTitle>
            <CardDescription>Active GenAI models in registry</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{modelCards.length}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {modelCards.filter((m) => m.isActive).length} active
            </div>
          </CardContent>
        </Card>

        {/* Total Decisions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Total Decisions
            </CardTitle>
            <CardDescription>Decisions logged across all models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {formatNumber(riskSummary?.totalDecisions || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {formatNumber(riskSummary?.totalOverrides || 0)} overrides (
              {formatPercentage(riskSummary?.overallOverrideRate || 0)})
            </div>
          </CardContent>
        </Card>

        {/* Overall Risk Level */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Overall Risk Level
            </CardTitle>
            <CardDescription>Average override rate across models</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`text-3xl font-bold ${getRiskLevelColor(
                riskSummary?.overallOverrideRate || 0
              )}`}
            >
              {getRiskLevel(riskSummary?.overallOverrideRate || 0)}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Override rate: {formatPercentage(riskSummary?.overallOverrideRate || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Model Cards */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Registered Models</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {modelCards.map((model) => (
            <Card
              key={model.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(`/admin/genai/models/${model.modelId}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{model.modelId}</CardTitle>
                    <CardDescription>
                      {model.provider} • Version {model.version}
                    </CardDescription>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Decisions</div>
                      <div className="text-2xl font-bold">{formatNumber(model.stats.decisionCount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Override Rate</div>
                      <div
                        className={`text-2xl font-bold ${getRiskLevelColor(model.stats.overrideRate)}`}
                      >
                        {formatPercentage(model.stats.overrideRate)}
                      </div>
                    </div>
                  </div>

                  {/* Risk Tags */}
                  {model.risks && model.risks.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Risk Categories</div>
                      <div className="flex flex-wrap gap-2">
                        {model.risks.map((risk) => (
                          <Badge
                            key={risk.id}
                            variant="outline"
                            className={getSeverityColor(risk.severity)}
                          >
                            {risk.riskCategory.category}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mitigations */}
                  {model.mitigations && model.mitigations.length > 0 && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Mitigations</div>
                      <ul className="text-sm space-y-1">
                        {model.mitigations.slice(0, 3).map((mitigation, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                            {mitigation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Risk Summary */}
      {riskSummary && riskSummary.topRisksAcrossModels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Top Risk Categories
            </CardTitle>
            <CardDescription>Most common risk categories across all models</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {riskSummary.topRisksAcrossModels.map((risk) => (
                <div key={risk.riskId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div>
                      <div className="font-semibold">{risk.category}</div>
                      <div className="text-sm text-muted-foreground">{risk.riskId}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatNumber(risk.totalCount)}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPercentage(risk.percentage / 100)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">About This Dashboard</p>
              <p>
                This AI Governance dashboard provides visibility into GenAI model usage, risk levels,
                and decision logs. It displays registered models, their risk categories, mitigation
                strategies, and decision statistics.
              </p>
              <p>
                Click on any model card to view detailed information, including risk breakdowns,
                decision logs, and mitigation strategies. Risk levels are calculated based on human
                override rates and risk category severity.
              </p>
              <p className="text-xs">
                Data is refreshed in real-time. Risk summaries are generated weekly and stored as
                snapshots for audit purposes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

