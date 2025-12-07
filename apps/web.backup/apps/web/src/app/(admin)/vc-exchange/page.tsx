'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface VCExchange {
  exchangeId: string;
  status: string;
  participants: string[];
  createdAt: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function VCExchangePage() {
  const [exchanges, setExchanges] = useState<VCExchange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState('');

  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (orgId) params.append('orgId', orgId);

      const response = await fetch(`${API_BASE}/api/vc-exchange/queue?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load exchanges (${response.status})`);
      }
      const data = await response.json();
      setExchanges(data);
    } catch (err) {
      console.error('Failed to fetch exchanges', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  const statusCounts = exchanges.reduce(
    (acc, ex) => {
      acc[ex.status] = (acc[ex.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in_progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VC Exchange Console</h1>
          <p className="text-muted-foreground">
            Monitor and manage in-flight verifiable credential exchanges.
          </p>
        </div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Input
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            placeholder="Filter by org ID"
            className="md:w-56"
          />
          <Button onClick={fetchExchanges} variant="secondary">
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exchanges</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exchanges.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.completed || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.in_progress || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.failed || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Exchange Queue</CardTitle>
          <CardDescription>Active and recent credential exchanges</CardDescription>
        </CardHeader>
        <CardContent>
          {exchanges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No exchanges found</div>
          ) : (
            <div className="space-y-2">
              {exchanges.map((exchange) => (
                <div
                  key={exchange.exchangeId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    {getStatusIcon(exchange.status)}
                    <div>
                      <div className="font-medium">{exchange.exchangeId}</div>
                      <div className="text-sm text-muted-foreground">
                        {exchange.participants.length} participant(s)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getStatusBadge(exchange.status)}
                    <div className="text-sm text-muted-foreground">
                      {new Date(exchange.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading exchanges...</div>
        </div>
      )}
    </div>
  );
}








