'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Mock data types
interface GraphNode {
  id: string;
  type: string;
  label: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;
}

interface Summary {
  summary: string;
  nodeCount: number;
  generatedAt: string;
}

export default function KnowledgeConsolePage() {
  const [orgId, setOrgId] = useState('demo-org'); // Default or from context
  const [summary, setSummary] = useState<Summary | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Fetch summary and insights
  const fetchKnowledge = async () => {
    setLoading(true);
    try {
      // Replace with actual API call
      // const res = await fetch(`/api/knowledge/summary?orgId=${orgId}`);
      // const data = await res.json();

      // Mock response for MVP
      setTimeout(() => {
        setSummary({
          summary: "Organization maintains strong compliance across 4 key policy areas. Credential velocity is high, but delays persist in CR2 verifications.",
          nodeCount: 142,
          generatedAt: new Date().toISOString()
        });
        setInsights([
          "Most delays occur at CR2 checks (Simulated Insight)",
          "Credential velocity increased by 15% this week",
          "Policy coverage gap identified in telehealth provisioning"
        ]);
        setLoading(false);
      }, 1000);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKnowledge();
  }, [orgId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Org Knowledge Console</h1>
          <p className="text-muted-foreground">Visualize and analyze organizational knowledge graph.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchKnowledge} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh Knowledge'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Graph Map</CardTitle>
              <CardDescription>Interactive visualization of entities and relationships</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px] flex items-center justify-center border-2 border-dashed rounded-md bg-slate-50">
              <div className="text-center text-muted-foreground">
                <p>Graph Visualization Placeholder</p>
                <p className="text-sm">(D3.js / React Flow integration)</p>
                <div className="mt-4 flex gap-2 justify-center">
                  <Badge variant="secondary">Credentials</Badge>
                  <Badge variant="secondary">Policies</Badge>
                  <Badge variant="secondary">Events</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Search Knowledge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Search policies, credentials, entities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button variant="outline">Search</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar / Insights */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {summary ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed">{summary.summary}</p>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Nodes: {summary.nodeCount}</span>
                    <span>Updated: {new Date(summary.generatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ) : (
                <div className="h-20 animate-pulse bg-slate-100 rounded" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Auto-Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {insights.map((insight, idx) => (
                  <li key={idx} className="flex gap-2 items-start text-sm">
                    <span className="text-primary text-lg leading-none">•</span>
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}


