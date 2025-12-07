'use client';

import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle, AlertCircle, Server, Database, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RemediationEvent {
  eventId: string;
  timestamp: string;
  action: string;
  payload: {
    rootCause: string;
    automated?: boolean;
    component?: string;
  };
  txId?: string;
}

export default function RemediationPage() {
  const [events, setEvents] = useState<RemediationEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        // In real app, use correct backend URL or proxy
        const res = await fetch('/api/audit?type=remediation');
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (e) {
        console.error('Failed to fetch remediation events', e);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    // Poll every 5 seconds for updates
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto space-y-6 py-8">
       <header className="space-y-3">
        <p className="text-sm uppercase tracking-wide text-muted-foreground">AI Ops • Remediation</p>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Activity className="h-7 w-7 text-primary" aria-hidden="true" />
          Self-Healing Timeline
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Audit log of autonomous system repairs, failovers, and restarts.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Repairs (24h)</CardTitle>
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{events.length}</div>
            </CardContent>
         </Card>
         <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-green-600">Healthy</div>
            </CardContent>
         </Card>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Remediation Log</CardTitle>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="text-muted-foreground">Loading events...</div>
            ) : events.length === 0 ? (
                <div className="text-muted-foreground">No remediation actions recorded recently.</div>
            ) : (
                <div className="space-y-6">
                    {events.map((event) => (
                        <div key={event.eventId} className="flex flex-col gap-2 border-b pb-4 last:border-0 last:pb-0">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ActionIcon action={event.action} />
                                    <span className="font-semibold">{formatActionName(event.action)}</span>
                                    {event.payload.automated && (
                                        <Badge variant="secondary" className="text-xs">Auto</Badge>
                                    )}
                                </div>
                                <span className="text-sm text-muted-foreground">
                                    {new Date(event.timestamp).toLocaleString()}
                                </span>
                            </div>

                            <div className="pl-8 space-y-1">
                                <p className="text-sm"><span className="font-medium">Root Cause:</span> {event.payload.rootCause}</p>
                                {event.txId && (
                                    <p className="text-xs text-muted-foreground font-mono">
                                        Anchor: {event.txId}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
    if (action.includes('ACA_PY')) return <Server className="h-5 w-5 text-blue-500" />;
    if (action.includes('SUBSTRATE')) return <Activity className="h-5 w-5 text-purple-500" />;
    if (action.includes('DB')) return <Database className="h-5 w-5 text-orange-500" />;
    return <AlertCircle className="h-5 w-5 text-gray-500" />;
}

function formatActionName(action: string) {
    return action.replace(/_/g, ' ');
}














