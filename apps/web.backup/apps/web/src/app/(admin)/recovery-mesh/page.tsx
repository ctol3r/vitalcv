'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RecoveryMeshPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/recovery-mesh`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load recovery mesh', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Autonomous System Recovery Mesh</CardTitle>
          <CardDescription>Self-diagnosing, self-healing infrastructure for backend, blockchain, agents & services</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">System Failures</h3>
                <div className="space-y-2">
                  {data.failures?.map((failure: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          failure.severity === 'critical' ? 'destructive' :
                          failure.severity === 'high' ? 'destructive' :
                          failure.severity === 'medium' ? 'secondary' : 'outline'
                        }>
                          {failure.severity}
                        </Badge>
                        <Badge variant="outline">{failure.type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(failure.detectedAt).toLocaleString()}
                        </span>
                      </div>
                      {failure.resolvedAt && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Resolved: {new Date(failure.resolvedAt).toLocaleString()}
                        </div>
                      )}
                      <div className="space-y-1">
                        {failure.recoveryActions?.map((action: string, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">• {action}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Recovery Agents</h3>
                <div className="space-y-2">
                  {data.recoveryAgents?.map((agent: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{agent.type}</span>
                        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{agent.lastAction}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Microservice Health</h3>
                <div className="space-y-2">
                  {data.microserviceHealth?.map((service: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{service.service}</span>
                        <Badge variant={
                          service.status === 'healthy' ? 'default' :
                          service.status === 'degraded' ? 'secondary' : 'destructive'
                        }>
                          {service.status}
                        </Badge>
                      </div>
                      {service.lastRestart && (
                        <p className="text-xs text-muted-foreground">
                          Last restart: {new Date(service.lastRestart).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Recovery Rehearsals</h3>
                <div className="space-y-2">
                  {data.recoveryRehearsals?.map((rehearsal: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{rehearsal.scenario}</span>
                        <Badge variant={rehearsal.success ? 'default' : 'destructive'}>
                          {rehearsal.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Recovery time: {rehearsal.recoveryTime}s
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(rehearsal.simulatedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No recovery mesh data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








