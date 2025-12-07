'use client';

import { Network, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function ValidityRouterPage() {
  const [credentialId, setCredentialId] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const fetchRouter = async () => {
    if (!credentialId.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/validity-router/${credentialId}`);
      if (res.ok) setData(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Network className="h-8 w-8" />
          Chain-Agnostic Credential Validity Router
        </h1>
        <p className="text-muted-foreground mt-2">
          Route credential validation through whichever chain or proof mechanism is most reliable at that moment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validity Routing</CardTitle>
          <CardDescription>Enter credential ID to view routing configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Credential ID"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchRouter()}
            />
            <Button onClick={fetchRouter} disabled={loading || !credentialId.trim()}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>

          {data && data.route && (
            <Card>
              <CardHeader>
                <CardTitle>Routing Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Primary Route</span>
                    <Badge>{data.route.primary}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reliability</span>
                    <div className="flex items-center gap-2">
                      <Progress value={data.route.reliability} className="w-32" />
                      <span>{data.route.reliability}/100</span>
                    </div>
                  </div>
                  {data.route.fallback && data.route.fallback.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm font-semibold mb-2">Fallback Routes</div>
                      <div className="flex gap-2">
                        {data.route.fallback.map((fb: string, i: number) => (
                          <Badge key={i} variant="secondary">{fb}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

