'use client';

import { useCallback, useEffect, useState } from 'react';
import { Network, CheckCircle2, XCircle, RefreshCw, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface InteropExchange {
  id: string;
  system: string;
  config: Record<string, unknown>;
  updatedAt: string;
}

interface SyncEvent {
  system: string;
  action: string;
  status: string;
  timestamp: string;
}

export default function InteropExchangePage() {
  const [exchanges, setExchanges] = useState<InteropExchange[]>([]);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchExchanges = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setExchanges([]);
      setSyncEvents([]);
    } catch (error) {
      console.error('Failed to fetch exchanges:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interop Exchange</h1>
          <p className="text-muted-foreground mt-2">
            Hub that can connect VitalCV to any healthcare IT system — EHR, scheduling, HRIS, CVO
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchExchanges} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Connected Systems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exchanges.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active integrations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Sync Events (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{syncEvents.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Total sync operations</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {syncEvents.length > 0
                ? ((syncEvents.filter((e) => e.status === 'success').length / syncEvents.length) * 100).toFixed(0)
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Connected Systems
          </CardTitle>
          <CardDescription>Healthcare IT system integrations</CardDescription>
        </CardHeader>
        <CardContent>
          {exchanges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No systems connected</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exchanges.map((exchange) => (
                  <TableRow key={exchange.id}>
                    <TableCell className="font-medium">{exchange.system}</TableCell>
                    <TableCell>
                      <Badge variant="outline">EHR</Badge>
                    </TableCell>
                    <TableCell>{new Date(exchange.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Connected
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {syncEvents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Sync Events</CardTitle>
            <CardDescription>Last 24 hours of inter-system synchronization</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>System</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncEvents.map((event, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{event.system}</TableCell>
                    <TableCell>{event.action}</TableCell>
                    <TableCell>
                      <Badge variant={event.status === 'success' ? 'default' : 'destructive'}>
                        {event.status === 'success' ? (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        ) : (
                          <XCircle className="mr-1 h-3 w-3" />
                        )}
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








