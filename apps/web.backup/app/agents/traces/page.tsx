"use client";
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertCircle, Shield, Zap, Database } from 'lucide-react';

interface AgentTrace {
  id: string;
  agentId: string;
  timestamp: number;
  eventType: 'tool_call' | 'breach' | 'decision' | 'error';
  breachType?: 'injection' | 'leak' | 'supply-chain' | 'tool' | 'llm';
  details: Record<string, unknown>;
}

interface AgentMetrics {
  agentId: string;
  level: 'Reactive' | 'Managed' | 'Proactive';
  readinessScore: number;
  breaches: {
    injection: number;
    leak: number;
    supplyChain: number;
    tool: number;
    llm: number;
  };
  lastUpdated: number;
}

/**
 * Agent Traces View with Breach Taxonomy
 * FE-AGENTS-001: Agent traces view with breach taxonomy legends
 */
export default function AgentTracesPage() {
  const [traces, setTraces] = useState<AgentTrace[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Fetch agent metrics
      const metricsRes = await fetch('/api/agents/metrics');
      const metricsData = await metricsRes.json();
      setMetrics(metricsData.agents || []);

      // Fetch traces (in production, this would be a real endpoint)
      // For now, generate mock traces from metrics
      const mockTraces: AgentTrace[] = [];
      metricsData.agents?.forEach((m: AgentMetrics) => {
        // Generate traces based on breach counts
        Object.entries(m.breaches).forEach(([type, count]) => {
          for (let i = 0; i < count; i++) {
            mockTraces.push({
              id: `trace-${m.agentId}-${type}-${i}`,
              agentId: m.agentId,
              timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
              eventType: 'breach',
              breachType: type as AgentTrace['breachType'],
              details: {
                severity: 'high',
                source: 'tool-call',
              },
            });
          }
        });
      });
      setTraces(mockTraces.sort((a, b) => b.timestamp - a.timestamp));
    } catch (error) {
      console.error('Failed to load agent data:', error);
    } finally {
      setLoading(false);
    }
  }

  const getBreachTypeColor = (type?: string) => {
    switch (type) {
      case 'injection':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'leak':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'supply-chain':
        return 'bg-purple-500/10 text-purple-700 dark:text-purple-400';
      case 'tool':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'llm':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Proactive':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'Managed':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'Reactive':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const filteredTraces = selectedAgent
    ? traces.filter(t => t.agentId === selectedAgent)
    : traces;

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-center text-muted-foreground">Loading agent traces...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Agent Traces & Breach Taxonomy</h1>
        <p className="text-sm text-muted-foreground">
          Monitor agent activity and security breaches. No PHI is displayed.
        </p>
      </div>

      {/* Breach Taxonomy Legend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Breach Taxonomy
          </CardTitle>
          <CardDescription>Classification of security breaches detected in agent operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Badge className={getBreachTypeColor('injection')}>
              <AlertCircle className="h-3 w-3 mr-1" />
              Injection
            </Badge>
            <Badge className={getBreachTypeColor('leak')}>
              <AlertCircle className="h-3 w-3 mr-1" />
              Leak
            </Badge>
            <Badge className={getBreachTypeColor('supply-chain')}>
              <AlertCircle className="h-3 w-3 mr-1" />
              Supply Chain
            </Badge>
            <Badge className={getBreachTypeColor('tool')}>
              <AlertCircle className="h-3 w-3 mr-1" />
              Tool
            </Badge>
            <Badge className={getBreachTypeColor('llm')}>
              <AlertCircle className="h-3 w-3 mr-1" />
              LLM
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Agent Metrics</TabsTrigger>
          <TabsTrigger value="traces">Traces</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <div className="grid gap-4">
            {metrics.map((m) => (
              <Card key={m.agentId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{m.agentId}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={getLevelColor(m.level)}>{m.level}</Badge>
                      <Badge variant="outline">
                        Score: {(m.readinessScore * 100).toFixed(0)}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2 text-xs">
                    <div>
                      <div className="text-muted-foreground">Injection</div>
                      <div className="font-semibold">{m.breaches.injection}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Leak</div>
                      <div className="font-semibold">{m.breaches.leak}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Supply Chain</div>
                      <div className="font-semibold">{m.breaches.supplyChain}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Tool</div>
                      <div className="font-semibold">{m.breaches.tool}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">LLM</div>
                      <div className="font-semibold">{m.breaches.llm}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedAgent(m.agentId)}
                    className="mt-3 text-xs text-primary hover:underline"
                  >
                    View traces →
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="traces">
          <div className="space-y-2">
            {filteredTraces.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No traces found</p>
              </div>
            ) : (
              filteredTraces.map((trace) => (
                <Card key={trace.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{trace.agentId}</span>
                          {trace.breachType && (
                            <Badge className={getBreachTypeColor(trace.breachType)}>
                              {trace.breachType}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs">
                            {trace.eventType}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(trace.timestamp).toLocaleString()}
                        </div>
                        {Object.keys(trace.details).length > 0 && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              View details
                            </summary>
                            <pre className="mt-2 rounded bg-muted p-2 overflow-x-auto">
                              {JSON.stringify(trace.details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

