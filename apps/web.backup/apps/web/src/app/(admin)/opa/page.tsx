/**
 * Batch 198 - Task 198.5 - OPA Live Evaluation UI
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OPAPage() {
  const [policy, setPolicy] = useState('');
  const [input, setInput] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/security/opa/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policy, input: JSON.parse(input || '{}') })
      });
      const data = await res.json();
      setResult(data);
    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">OPA Policy Simulation</h1>
        <p className="text-muted-foreground mt-2">
          Test OPA policies before deployment
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Policy Simulator</CardTitle>
          <CardDescription>Enter policy and input to simulate</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Policy</Label>
            <Textarea
              placeholder="OPA policy code"
              value={policy}
              onChange={(e) => setPolicy(e.target.value)}
              rows={10}
            />
          </div>
          <div>
            <Label>Input (JSON)</Label>
            <Textarea
              placeholder='{"user": "admin", "resource": "/api/psv"}'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
            />
          </div>
          <Button onClick={handleSimulate} disabled={loading}>
            Simulate Policy
          </Button>
          {result && (
            <Alert>
              <AlertDescription>
                <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

