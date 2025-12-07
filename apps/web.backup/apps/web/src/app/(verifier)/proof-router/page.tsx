'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Batch 386.4 - Proof Routing UI
 * Task 386.8 - Route Graph Visualization
 */

export default function ProofRouterPage() {
  const [proofType, setProofType] = useState<string>('VC');
  const [decision, setDecision] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const routeProof = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/proof-router/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proofType }),
      });
      const data = await res.json();
      setDecision(data);
    } catch (error) {
      console.error('Failed to route proof:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGraph = async () => {
    try {
      const res = await fetch('/api/proof-router/graph');
      const data = await res.json();
      setGraph(data);
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Multi-Chain Proof Router</h1>

      <Card>
        <CardHeader>
          <CardTitle>Route Verification</CardTitle>
          <CardDescription>Route verification through optimal trust path</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={proofType} onValueChange={setProofType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Proof Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="VC">VC</SelectItem>
                <SelectItem value="SD-JWT">SD-JWT</SelectItem>
                <SelectItem value="BBS+">BBS+</SelectItem>
                <SelectItem value="EUDI">EUDI</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={routeProof} disabled={loading}>
              Route
            </Button>
            <Button variant="outline" onClick={fetchGraph}>
              View Graph
            </Button>
          </div>

          {decision && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Routing Decision</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Proof Type:</strong> {decision.proofType}</p>
                  <p><strong>Chain:</strong> {decision.chain}</p>
                  <p><strong>Route:</strong> {decision.route}</p>
                  <p><strong>Trust Score:</strong> {(decision.trustScore * 100).toFixed(1)}%</p>
                  <p><strong>Latency:</strong> {decision.latency}ms</p>
                  {decision.fallback && (
                    <p><strong>Fallback:</strong> {decision.fallback.route}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {graph && (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle>Route Graph</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Nodes:</strong> {graph.nodes?.length || 0}</p>
                  <p><strong>Edges:</strong> {graph.edges?.length || 0}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

