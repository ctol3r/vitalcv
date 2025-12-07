/**
 * Batch 198 - Task 198.8 - Security Incident Response Panel
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SecurityPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [soc2Evidence, setSoc2Evidence] = useState<any>(null);

  useEffect(() => {
    // Fetch incidents and SOC2 evidence
    fetch('/api/security/soc2/collect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId: 'default',
        period: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        }
      })
    })
      .then(res => res.json())
      .then(data => setSoc2Evidence(data))
      .catch(console.error);
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Security Incident Response</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and respond to security incidents
        </p>
      </div>

      <Tabs defaultValue="incidents" className="w-full">
        <TabsList>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="soc2">SOC2 Evidence</TabsTrigger>
          <TabsTrigger value="siem">SIEM Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Security Incidents</CardTitle>
              <CardDescription>Active and resolved security incidents</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="text-muted-foreground">No active incidents</p>
              ) : (
                <div className="space-y-2">
                  {incidents.map((incident, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{incident.type}</p>
                        <p className="text-sm text-muted-foreground">{incident.timestamp}</p>
                      </div>
                      <Badge>{incident.severity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="soc2">
          <Card>
            <CardHeader>
              <CardTitle>SOC2 Evidence Collection</CardTitle>
              <CardDescription>Automated evidence collection for SOC2 compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {soc2Evidence && (
                <div className="space-y-2">
                  <p>Access Logs: {soc2Evidence.accessLogs}</p>
                  <p>Anchors: {soc2Evidence.anchors}</p>
                  <p>Collected At: {soc2Evidence.collectedAt}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="siem">
          <Card>
            <CardHeader>
              <CardTitle>SIEM Integration</CardTitle>
              <CardDescription>Export logs to Splunk/Sentinel</CardDescription>
            </CardHeader>
            <CardContent>
              <Button>Export to Splunk</Button>
              <Button className="ml-2">Export to Sentinel</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

