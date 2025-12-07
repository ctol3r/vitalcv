/**
 * Batch 196 - Task 196.8 - HITL Override Panel
 * Human-in-the-loop override panel for PSV automation
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PSVAgentState {
  nppesAgent?: {
    status: 'idle' | 'running' | 'completed' | 'error';
    npiMapping?: string;
    inconsistencies?: any[];
  };
  licenseAgent?: {
    status: 'idle' | 'running' | 'completed' | 'error';
    queries?: any[];
    results?: any[];
  };
  sanctionsAgent?: {
    status: 'idle' | 'running' | 'completed' | 'error';
    sources?: string[];
    findings?: any[];
  };
  ocrAgent?: {
    status: 'idle' | 'running' | 'completed' | 'error';
    extracted?: any;
    confidence?: number;
  };
  conflictAgent?: {
    status: 'idle' | 'running' | 'completed' | 'error';
    conflicts?: any[];
    resolution?: any;
  };
}

interface AutomationLevel {
  nppesAutoLink: boolean;
  licenseAutoQuery: boolean;
  sanctionsAutoCheck: boolean;
  ocrAutoExtract: boolean;
  conflictAutoResolve: boolean;
  requireHITL: boolean;
}

export default function HITLPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [agentState, setAgentState] = useState<PSVAgentState | null>(null);
  const [automationLevel, setAutomationLevel] = useState<AutomationLevel | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchAgentState = async () => {
    if (!clinicianId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/psv/state/${clinicianId}`);
      const data = await res.json();
      setAgentState(data.agentState || {});
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchAutomationLevel = async () => {
    // In production, get orgId from auth context
    const orgId = 'default';
    try {
      const res = await fetch(`/api/psv/automation/${orgId}`);
      const data = await res.json();
      setAutomationLevel(data);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  useEffect(() => {
    if (clinicianId) {
      fetchAgentState();
    }
  }, [clinicianId]);

  useEffect(() => {
    fetchAutomationLevel();
  }, []);

  const handleOverride = async (agent: string, action: string, data: any) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/psv/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId, agent, action, data })
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Override applied successfully' });
        await fetchAgentState();
      } else {
        const error = await res.json();
        setMessage({ type: 'error', text: error.error || 'Override failed' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAutomationToggle = async (field: keyof AutomationLevel, value: boolean) => {
    if (!automationLevel) return;
    const updated = { ...automationLevel, [field]: value };
    setAutomationLevel(updated);

    const orgId = 'default';
    try {
      await fetch(`/api/psv/automation/${orgId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setMessage({ type: 'success', text: 'Automation level updated' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const getStatusBadge = (status?: string) => {
    const colors: Record<string, string> = {
      idle: 'bg-gray-500',
      running: 'bg-blue-500',
      completed: 'bg-green-500',
      error: 'bg-red-500'
    };
    return (
      <Badge className={colors[status || 'idle'] || 'bg-gray-500'}>
        {status || 'idle'}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">HITL Override Panel</h1>
          <p className="text-muted-foreground mt-2">
            Human-in-the-loop governance for PSV automation
          </p>
        </div>
      </div>

      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : 'border-green-500'}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clinician Lookup</CardTitle>
          <CardDescription>Enter clinician ID to view PSV agent state</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Clinician ID"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
            />
            <Button onClick={fetchAgentState} disabled={loading || !clinicianId}>
              Load State
            </Button>
          </div>
        </CardContent>
      </Card>

      {automationLevel && (
        <Card>
          <CardHeader>
            <CardTitle>PSV Automation Level</CardTitle>
            <CardDescription>Configure automation toggles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>NPPES Auto-Link</Label>
              <Switch
                checked={automationLevel.nppesAutoLink}
                onCheckedChange={(v) => handleAutomationToggle('nppesAutoLink', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>License Auto-Query</Label>
              <Switch
                checked={automationLevel.licenseAutoQuery}
                onCheckedChange={(v) => handleAutomationToggle('licenseAutoQuery', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sanctions Auto-Check</Label>
              <Switch
                checked={automationLevel.sanctionsAutoCheck}
                onCheckedChange={(v) => handleAutomationToggle('sanctionsAutoCheck', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>OCR Auto-Extract</Label>
              <Switch
                checked={automationLevel.ocrAutoExtract}
                onCheckedChange={(v) => handleAutomationToggle('ocrAutoExtract', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Conflict Auto-Resolve</Label>
              <Switch
                checked={automationLevel.conflictAutoResolve}
                onCheckedChange={(v) => handleAutomationToggle('conflictAutoResolve', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Require HITL</Label>
              <Switch
                checked={automationLevel.requireHITL}
                onCheckedChange={(v) => handleAutomationToggle('requireHITL', v)}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {agentState && (
        <Tabs defaultValue="nppes" className="w-full">
          <TabsList>
            <TabsTrigger value="nppes">NPPES Agent</TabsTrigger>
            <TabsTrigger value="license">License Agent</TabsTrigger>
            <TabsTrigger value="sanctions">Sanctions Agent</TabsTrigger>
            <TabsTrigger value="ocr">OCR Agent</TabsTrigger>
            <TabsTrigger value="conflict">Conflict Agent</TabsTrigger>
          </TabsList>

          <TabsContent value="nppes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>NPPES Auto-Link Agent</CardTitle>
                  {getStatusBadge(agentState.nppesAgent?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {agentState.nppesAgent?.npiMapping && (
                  <div>
                    <Label>NPI Mapping</Label>
                    <p className="text-sm">{agentState.nppesAgent.npiMapping}</p>
                  </div>
                )}
                {agentState.nppesAgent?.inconsistencies && agentState.nppesAgent.inconsistencies.length > 0 && (
                  <div>
                    <Label>Inconsistencies</Label>
                    <pre className="text-xs bg-muted p-2 rounded">
                      {JSON.stringify(agentState.nppesAgent.inconsistencies, null, 2)}
                    </pre>
                    <Button
                      className="mt-2"
                      onClick={() => handleOverride('nppes', 'resolve', {})}
                    >
                      Resolve Conflicts
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="license">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>License Direct-Query Agent</CardTitle>
                  {getStatusBadge(agentState.licenseAgent?.status)}
                </div>
              </CardHeader>
              <CardContent>
                {agentState.licenseAgent?.results && (
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(agentState.licenseAgent.results, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sanctions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Sanctions Correlation Agent</CardTitle>
                  {getStatusBadge(agentState.sanctionsAgent?.status)}
                </div>
              </CardHeader>
              <CardContent>
                {agentState.sanctionsAgent?.findings && (
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(agentState.sanctionsAgent.findings, null, 2)}
                  </pre>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ocr">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Document OCR Extractor</CardTitle>
                  {getStatusBadge(agentState.ocrAgent?.status)}
                </div>
              </CardHeader>
              <CardContent>
                {agentState.ocrAgent?.extracted && (
                  <div className="space-y-2">
                    <div>
                      <Label>Confidence</Label>
                      <p className="text-sm">{agentState.ocrAgent.confidence}</p>
                    </div>
                    <pre className="text-xs bg-muted p-2 rounded">
                      {JSON.stringify(agentState.ocrAgent.extracted, null, 2)}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="conflict">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Conflict Resolution Agent</CardTitle>
                  {getStatusBadge(agentState.conflictAgent?.status)}
                </div>
              </CardHeader>
              <CardContent>
                {agentState.conflictAgent?.conflicts && agentState.conflictAgent.conflicts.length > 0 && (
                  <div className="space-y-4">
                    <div>
                      <Label>Conflicts</Label>
                      <pre className="text-xs bg-muted p-2 rounded">
                        {JSON.stringify(agentState.conflictAgent.conflicts, null, 2)}
                      </pre>
                    </div>
                    {agentState.conflictAgent.resolution && (
                      <div>
                        <Label>Resolution</Label>
                        <pre className="text-xs bg-muted p-2 rounded">
                          {JSON.stringify(agentState.conflictAgent.resolution, null, 2)}
                        </pre>
                      </div>
                    )}
                    <Button
                      onClick={() => handleOverride('conflict', 'manual_resolve', {})}
                    >
                      Manual Override
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

