'use client';

import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Sparkles,
  FileText,
  ArrowRight,
  RefreshCw,
  Download,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface GapPrediction {
  id: string;
  predictionType: 'credential' | 'skill' | 'compliance';
  gapType: string;
  severity: 'urgent' | 'required' | 'recommended';
  title: string;
  description: string;
  predictionScore: number;
  trustScoreImpact?: number;
  timeline?: { daysUntilExpiry?: number; forecastDate?: string };
  recommendations: Array<{
    action: string;
    priority: number;
    description: string;
  }>;
  metadata?: {
    credentialType?: string;
    state?: string;
    skill?: string;
    unit?: string;
  };
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

interface PredictionSummary {
  total: number;
  urgent: number;
  required: number;
  recommended: number;
  resolved: number;
}

interface PredictionResult {
  gaps: GapPrediction[];
  summary: {
    totalGaps: number;
    urgentCount: number;
    requiredCount: number;
    recommendedCount: number;
    avgTrustScoreImpact: number;
  };
  contextSnapshot: {
    timestamp: string;
    credentialCount: number;
    skillCount: number;
  };
}

export default function GapPredictionsPage() {
  const [predictions, setPredictions] = useState<GapPrediction[]>([]);
  const [summary, setSummary] = useState<PredictionSummary>({
    total: 0,
    urgent: 0,
    required: 0,
    recommended: 0,
    resolved: 0,
  });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'all' | 'credential' | 'skill' | 'compliance'>('all');

  // Get clinician ID from session/localStorage (placeholder)
  const clinicianId = typeof window !== 'undefined'
    ? localStorage.getItem('clinicianId') || 'demo-clinician-123'
    : 'demo-clinician-123';

  useEffect(() => {
    loadPredictions();
  }, [clinicianId]);

  const loadPredictions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/api/ai/predict/gaps/${clinicianId}`);
      const data = await response.json();

      if (data.ok) {
        setPredictions(data.predictions || []);
        setSummary(data.summary || {
          total: 0,
          urgent: 0,
          required: 0,
          recommended: 0,
          resolved: 0,
        });
      }
    } catch (error) {
      console.error('Failed to load predictions:', error);
    } finally {
      setLoading(false);
    }
  };

  const generatePredictions = async () => {
    try {
      setGenerating(true);
      const response = await fetch(`${API_BASE}/api/ai/predict/gaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          useAI: true,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        // Reload predictions
        await loadPredictions();
      }
    } catch (error) {
      console.error('Failed to generate predictions:', error);
    } finally {
      setGenerating(false);
    }
  };

  const resolveGap = async (gapId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/predict/gaps/${gapId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId }),
      });

      if (response.ok) {
        await loadPredictions();
      }
    } catch (error) {
      console.error('Failed to resolve gap:', error);
    }
  };

  const filteredPredictions = predictions.filter(p => {
    if (selectedTab === 'all') return !p.resolved;
    return p.predictionType === selectedTab && !p.resolved;
  });

  const severityConfig = {
    urgent: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    required: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    recommended: { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  };

  const getActionButton = (action: string, gap: GapPrediction) => {
    const actions: Record<string, { label: string; variant: 'default' | 'outline' | 'secondary' }> = {
      renew: { label: 'Renew Credential', variant: 'default' },
      obtain: { label: 'Obtain Credential', variant: 'default' },
      upskill: { label: 'Start Training', variant: 'outline' },
      request_endorsement: { label: 'Request Endorsement', variant: 'outline' },
      upload_evidence: { label: 'Upload Evidence', variant: 'secondary' },
    };

    const config = actions[action] || { label: 'Take Action', variant: 'default' };

    return (
      <Button
        size="sm"
        variant={config.variant}
        onClick={() => {
          // Handle action - would navigate to appropriate page
          console.log('Action:', action, gap);
        }}
      >
        {config.label}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    );
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-purple-600" />
            AI Gap Predictor
          </h1>
          <p className="text-muted-foreground mt-2">
            AI-powered insights into credential and skill gaps affecting your career
          </p>
        </div>
        <Button onClick={generatePredictions} disabled={generating}>
          <RefreshCw className={cn('mr-2 h-4 w-4', generating && 'animate-spin')} />
          {generating ? 'Generating...' : 'Generate Predictions'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.resolved} resolved
            </p>
          </CardContent>
        </Card>

        <Card className={cn('border-red-200', summary.urgent > 0 && 'bg-red-50')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Urgent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{summary.urgent}</div>
            <p className="text-xs text-muted-foreground mt-1">Requires immediate action</p>
          </CardContent>
        </Card>

        <Card className={cn('border-orange-200', summary.required > 0 && 'bg-orange-50')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{summary.required}</div>
            <p className="text-xs text-muted-foreground mt-1">Needed for roles</p>
          </CardContent>
        </Card>

        <Card className={cn('border-blue-200', summary.recommended > 0 && 'bg-blue-50')}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              Recommended
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{summary.recommended}</div>
            <p className="text-xs text-muted-foreground mt-1">Career growth</p>
          </CardContent>
        </Card>
      </div>

      {/* Highest Impact Gaps Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Your Highest Impact Gaps</CardTitle>
          <CardDescription>
            Gaps sorted by trustScore impact and prediction confidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">All Gaps</TabsTrigger>
              <TabsTrigger value="credential">Credentials</TabsTrigger>
              <TabsTrigger value="skill">Skills</TabsTrigger>
              <TabsTrigger value="compliance">Compliance</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6 space-y-4">
              {filteredPredictions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No active gaps found. Great job!</p>
                </div>
              ) : (
                filteredPredictions
                  .sort((a, b) => {
                    // Sort by severity, then by trustScore impact
                    const severityOrder = { urgent: 0, required: 1, recommended: 2 };
                    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
                    if (severityDiff !== 0) return severityDiff;
                    return (b.trustScoreImpact || 0) - (a.trustScoreImpact || 0);
                  })
                  .map((gap) => {
                    const config = severityConfig[gap.severity];
                    const Icon = config.icon;

                    return (
                      <Card
                        key={gap.id}
                        className={cn('border-l-4', config.border, config.bg)}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-3">
                                <Icon className={cn('h-5 w-5', config.color)} />
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{gap.title}</h3>
                                    <Badge variant="outline" className={config.color}>
                                      {gap.severity}
                                    </Badge>
                                    <Badge variant="secondary">
                                      {gap.predictionType}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {gap.description}
                                  </p>
                                </div>
                              </div>

                              {/* Timeline */}
                              {gap.timeline?.daysUntilExpiry && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span>
                                    Expires in {gap.timeline.daysUntilExpiry} days
                                  </span>
                                </div>
                              )}

                              {/* Trust Score Impact */}
                              {gap.trustScoreImpact && (
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      Trust Score Impact
                                    </span>
                                    <span className="font-medium">
                                      {(gap.trustScoreImpact * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                  <Progress value={gap.trustScoreImpact * 100} className="h-2" />
                                </div>
                              )}

                              {/* Recommendations */}
                              {gap.recommendations.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-sm font-medium">Recommended Actions:</p>
                                  <div className="flex flex-wrap gap-2">
                                    {gap.recommendations
                                      .sort((a, b) => a.priority - b.priority)
                                      .map((rec, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                          {getActionButton(rec.action, gap)}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              )}

                              {/* Prediction Score */}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>Confidence: {(gap.predictionScore * 100).toFixed(0)}%</span>
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resolveGap(gap.id)}
                              className="ml-4"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-2" />
                              Mark Resolved
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Predictive Match Improvements */}
      {predictions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Predictive Match Improvements</CardTitle>
            <CardDescription>
              Estimated impact of resolving gaps on job matching
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {predictions
                .filter(g => !g.resolved && g.trustScoreImpact)
                .slice(0, 5)
                .map(gap => (
                  <div key={gap.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{gap.title}</p>
                      <p className="text-sm text-muted-foreground">
                        Resolving this gap could improve your match score
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        +{(gap.trustScoreImpact || 0) * 100}%
                      </div>
                      <p className="text-xs text-muted-foreground">match improvement</p>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

