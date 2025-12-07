'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Anchor, Download, Activity } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

interface VerificationState {
  currentState: string;
  proofType: string;
  chainHealth: string;
  verifierPrivilege: string;
  transitions: Array<{ from: string; to: string; timestamp: string; reason: string }>;
}

export default function VerificationStateMachinePage() {
  const [state, setState] = useState<VerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState('session-1');

  useEffect(() => {
    loadState();
  }, [sessionId]);

  async function loadState() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/verification/state-machine/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch (error) {
      console.error('Failed to load state machine', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="container mx-auto p-6">Loading...</div>;
  if (!state) return <div className="container mx-auto p-6">No data available</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Verification State Machine</h1>
          <p className="text-muted-foreground">AI-powered verification state management</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => fetch(`${API_BASE}/api/verification/state-machine/${sessionId}/export`).then(r => r.json()).then(d => {
            const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `state-machine-${sessionId}.json`;
            a.click();
          })} variant="outline">
            <Download className="w-4 h-4 mr-2" /> Export
          </Button>
          <Button onClick={() => fetch(`${API_BASE}/api/verification/state-machine/${sessionId}/anchor`, { method: 'POST' }).then(r => r.json()).then(d => alert(`Anchored: ${d.txHash}`))} variant="outline">
            <Anchor className="w-4 h-4 mr-2" /> Anchor
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current State</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>State</span>
              <Badge variant="default">{state.currentState}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Proof Type</span>
              <Badge>{state.proofType}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Chain Health</span>
              <Badge variant={state.chainHealth === 'healthy' ? 'default' : state.chainHealth === 'degraded' ? 'secondary' : 'destructive'}>
                {state.chainHealth}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Verifier Privilege</span>
              <Badge>{state.verifierPrivilege}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {state.transitions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>State Transitions</CardTitle>
          </CardHeader>
          <CardContent>
            {state.transitions.map((transition, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 border rounded mb-2">
                <div>
                  <span className="font-medium">{transition.from}</span>
                  <span className="mx-2">→</span>
                  <span className="font-medium">{transition.to}</span>
                  <span className="text-sm text-muted-foreground ml-2">{transition.reason}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {new Date(transition.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

