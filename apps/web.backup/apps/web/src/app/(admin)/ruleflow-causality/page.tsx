'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RuleflowCausality {
  region: string;
  causality: {
    rules: Array<{
      ruleId: string;
      dependsOn: string[];
      triggers: string[];
    }>;
    cascades: Array<{
      trigger: string;
      cascade: string[];
      severity: string;
    }>;
  };
  graph: {
    nodes: Array<{ id: string; jurisdiction: string }>;
    edges: Array<{ from: string; to: string; type: string }>;
  };
}

export default function RuleflowCausalityPage() {
  const [ruleflow, setRuleflow] = useState<RuleflowCausality | null>(null);
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');

  const fetchRuleflow = async () => {
    if (!region) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/ruleflow-causality/${region}`);
      const data = await res.json();
      setRuleflow(data);
    } catch (error) {
      console.error('Failed to fetch ruleflow causality:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Regulatory Ruleflow Causality Engine</h1>
        <p className="text-muted-foreground mt-2">
          Model the causal chain of regulatory rules — how one rule triggers another across jurisdictions
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Region</CardTitle>
          <CardDescription>Enter region to view ruleflow causality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="Enter region (e.g., US, EU, APAC)"
              className="flex-1 px-3 py-2 border rounded-md"
            />
            <button
              onClick={fetchRuleflow}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Load
            </button>
          </div>
        </CardContent>
      </Card>

      {loading && <div className="text-center py-8">Loading...</div>}

      {ruleflow && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Causality Graph</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm font-semibold mb-2">Nodes: {ruleflow.graph.nodes.length}</div>
                <div className="text-sm font-semibold mb-2">Edges: {ruleflow.graph.edges.length}</div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {ruleflow.graph.edges.slice(0, 20).map((edge, idx) => (
                    <div key={idx} className="text-sm border rounded p-2">
                      <span className="font-semibold">{edge.from}</span>
                      <span className="mx-2">→</span>
                      <span className="font-semibold">{edge.to}</span>
                      <Badge variant="outline" className="ml-2">{edge.type}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rule Dependencies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ruleflow.causality.rules.slice(0, 10).map((rule, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="font-semibold mb-2">Rule: {rule.ruleId}</div>
                    {rule.dependsOn.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-semibold mb-1">Depends On:</div>
                        <div className="flex flex-wrap gap-2">
                          {rule.dependsOn.map((dep, dIdx) => (
                            <Badge key={dIdx} variant="outline">{dep}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {rule.triggers.length > 0 && (
                      <div className="mt-2">
                        <div className="text-sm font-semibold mb-1">Triggers:</div>
                        <div className="flex flex-wrap gap-2">
                          {rule.triggers.map((trigger, tIdx) => (
                            <Badge key={tIdx} variant="secondary">{trigger}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cascades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {ruleflow.causality.cascades.map((cascade, idx) => (
                  <Alert key={idx} variant={cascade.severity === 'high' ? 'destructive' : 'default'}>
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className="font-semibold">Trigger: {cascade.trigger}</div>
                        <div className="text-sm">
                          <Badge variant={cascade.severity === 'high' ? 'destructive' : cascade.severity === 'medium' ? 'secondary' : 'outline'}>
                            {cascade.severity}
                          </Badge>
                        </div>
                        <div className="text-sm mt-2">Cascade: {cascade.cascade.join(' → ')}</div>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}








