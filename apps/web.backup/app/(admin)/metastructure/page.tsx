
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, RefreshCw, CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";

interface Bottleneck {
  component: string;
  probability: number;
  impact: string;
}

interface Drift {
  metric: string;
  current: string;
  predicted_30d: string;
  status: string;
}

interface Migration {
  resource: string;
  reason: string;
  strategy: string;
  priority: string;
}

interface Correction {
  id: string;
  action: string;
  impact: string;
  confidence: number;
}

interface MetastructureReport {
  orgId: string;
  timestamp: string;
  analysis: {
    knowledgeGraph: any;
    bottlenecks: Bottleneck[];
    drift: Drift;
  };
  recommendations: {
    migrations: Migration[];
    corrections: Correction[];
  };
}

export default function MetastructurePage() {
  const [report, setReport] = useState<MetastructureReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // In a real app, orgId would come from context or route params
  const orgId = "demo-org";

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/metastructure/report?orgId=${orgId}`);
      if (!res.ok) throw new Error('Failed to fetch report');
      const data = await res.json();
      setReport(data);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: "Failed to fetch metastructure report" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const handleUpdate = async () => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/metastructure/update`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, settings: {} }) // Trigger auto-update
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setMessage({ type: 'success', text: "Metastructure configuration updated successfully" });
      fetchReport(); // Refresh report to show new state
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !report) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Metastructure Engine</h1>
          <p className="text-muted-foreground">Self-optimizing platform analysis and configuration</p>
        </div>
        <Button onClick={fetchReport} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertTitle>{message.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {report && (
        <Tabs defaultValue="analysis" className="space-y-4">
          <TabsList>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="logs">Change Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Bottleneck Predictions</CardTitle>
                  <CardDescription>Predicted system constraints based on current load</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {report.analysis.bottlenecks.map((b, i) => (
                      <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <div className="font-medium">{b.component}</div>
                          <div className="text-sm text-muted-foreground">Probability: {(b.probability * 100).toFixed(0)}%</div>
                        </div>
                        <Badge variant={b.impact === 'high' ? 'destructive' : 'secondary'}>{b.impact} Impact</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Drift</CardTitle>
                  <CardDescription>Predicted metric deviations over 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Metric</span>
                      <span>{report.analysis.drift.metric}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Current</span>
                      <span>{report.analysis.drift.current}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Predicted (30d)</span>
                      <span className="text-orange-600 font-bold">{report.analysis.drift.predicted_30d}</span>
                    </div>
                    <div className="mt-4">
                      <Badge variant="outline" className="w-full justify-center">{report.analysis.drift.status.toUpperCase()}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Suggested Modifications</CardTitle>
                <CardDescription>Review and apply recommended configuration changes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">Auto-Correction Proposals</h3>
                  <div className="space-y-3">
                    {report.recommendations.corrections.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-4 border rounded-lg bg-slate-50 dark:bg-slate-900">
                        <div className="space-y-1">
                          <div className="font-bold">{c.action}</div>
                          <div className="text-sm text-muted-foreground">{c.impact}</div>
                          <div className="text-xs text-blue-600">Confidence: {(c.confidence * 100).toFixed(0)}%</div>
                        </div>
                        <Button onClick={handleUpdate} disabled={actionLoading} size="sm">
                          {actionLoading ? <Loader2 className="animate-spin h-4 w-4" /> : "Apply"}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-2">Suggested Migrations</h3>
                  <div className="space-y-3">
                    {report.recommendations.migrations.map((m, i) => (
                      <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-bold">{m.resource}</div>
                          <div className="text-sm">{m.reason}</div>
                          <div className="text-xs text-muted-foreground">Strategy: {m.strategy} • Priority: {m.priority}</div>
                        </div>
                        <Button variant="secondary" size="sm">Review</Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Change Logs</CardTitle>
                <CardDescription>History of applied metastructure configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">No historical changes recorded yet.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}


