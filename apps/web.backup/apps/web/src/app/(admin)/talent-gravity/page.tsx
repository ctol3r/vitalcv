'use client';

import { useEffect, useState } from 'react';
import { Magnet, TrendingUp, AlertTriangle, RefreshCcw, Download, Anchor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface GravityNode {
  id: string;
  type: string;
  gravity: number;
}

interface GravityData {
  nodes: GravityNode[];
  collisions: Array<{ node1: string; node2: string; conflict: string }>;
  shifts: Array<{ node: string; oldGravity: number; newGravity: number; reason: string }>;
  migration: Array<{ from: string; to: string; count: number }>;
}

export default function TalentGravityPage() {
  const [gravity, setGravity] = useState<GravityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGravity();
  }, []);

  async function loadGravity() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/gravity`);
      if (response.ok) {
        const data = await response.json();
        setGravity(data);
      }
    } catch (error) {
      console.error('Failed to load gravity data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/gravity/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Talent Gravity Model</h1>
          <p className="text-muted-foreground mt-2">
            Model how strongly roles, employers & regions pull clinicians
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadGravity} variant="outline" disabled={loading}>
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {gravity && (
            <Button onClick={handleAnchor} variant="outline">
              <Anchor className="h-4 w-4 mr-2" />
              Anchor
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      ) : gravity ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Nodes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{gravity.nodes.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Roles & Employers</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Collisions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{gravity.collisions.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Conflicts</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Shifts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{gravity.shifts.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Predicted</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Migration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{gravity.migration.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Patterns</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Gravity Nodes</CardTitle>
              <CardDescription>Roles, employers, and regions with their pull scores</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {gravity.nodes.slice(0, 20).map((node, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                    <Magnet className="h-4 w-4 text-blue-500" />
                    <div className="flex-1">
                      <div className="font-medium">{node.id}</div>
                      <div className="text-sm text-muted-foreground capitalize">{node.type}</div>
                    </div>
                    <Badge variant={node.gravity > 0.7 ? 'default' : node.gravity > 0.4 ? 'secondary' : 'outline'}>
                      {node.gravity.toFixed(2)}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {gravity.collisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Gravity Collisions</CardTitle>
                <CardDescription>Conflicting pulls across roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gravity.collisions.map((collision, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <div className="flex-1">
                        <div className="font-medium">{collision.node1} ↔ {collision.node2}</div>
                        <div className="text-sm text-muted-foreground">{collision.conflict}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {gravity.migration.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Talent Migration Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {gravity.migration.map((migration, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <div className="flex-1">
                        <div className="font-medium">{migration.from} → {migration.to}</div>
                      </div>
                      <Badge>{migration.count} moves</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No gravity data available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

