'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function AIWorkflowsPage() {
  const [workflow, setWorkflow] = useState<string>('');
  const [credentialId, setCredentialId] = useState<string>('');
  const [customInput, setCustomInput] = useState<string>('{}');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);

  const workflows = [
    "Pre-Issuance Compliance Sweep",
    "Eligibility + Compact Check",
    "Pre-Employment Verification Bundle",
    "Generic Agent Task"
  ];

  const runWorkflow = async () => {
    if (!workflow) return;

    setLoading(true);
    setResult(null);

    try {
      const inputJson = JSON.parse(customInput);

      let workflowName = workflow;
      if (workflow === "Generic Agent Task" && inputJson.task) {
          workflowName = inputJson.task;
      }

      // Use environment variable for API URL if available, otherwise relative path which might be proxied
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || ''}/api/agents/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workflowName,
          credentialId,
          input: inputJson
        }),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error running workflow:', error);
      setResult({ status: 'failed', summary: 'Failed to run workflow', logs: [(error as Error).message] });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">AI Workflow Orchestrator</h1>
            <p className="text-muted-foreground mt-2">
                Run and test multi-agent workflows for compliance, verification, and analysis.
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Workflow Configuration</CardTitle>
                    <CardDescription>Select a workflow and provide inputs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Workflow Type</Label>
                        <Select onValueChange={setWorkflow} value={workflow}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select workflow..." />
                            </SelectTrigger>
                            <SelectContent>
                                {workflows.map((w) => (
                                    <SelectItem key={w} value={w}>{w}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Credential ID (Optional)</Label>
                        <Input
                            placeholder="e.g. cred_123..."
                            value={credentialId}
                            onChange={(e) => setCredentialId(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label>Additional Input (JSON)</Label>
                        <Textarea
                            placeholder="{}"
                            className="font-mono text-xs h-32"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                        />
                    </div>

                    <Button
                        className="w-full"
                        onClick={runWorkflow}
                        disabled={loading || !workflow}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Running Agents...
                            </>
                        ) : (
                            "Run Workflow"
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-2">
            <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Execution Results</span>
                        {result && (
                            <Badge variant={result.status === 'success' ? 'default' : 'destructive'}>
                                {result.status === 'success' ? 'Complete' : 'Failed'}
                            </Badge>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col min-h-[500px]">
                    {!result && !loading && (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            Select a workflow and click Run to see results.
                        </div>
                    )}

                    {loading && (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-muted-foreground">Orchestrating agents...</p>
                        </div>
                    )}

                    {result && (
                        <div className="space-y-6">
                            {/* Summary */}
                            <div className="bg-muted/50 p-4 rounded-lg border">
                                <h3 className="font-semibold mb-2">Summary</h3>
                                <p className="text-sm">{result.summary}</p>
                            </div>

                            {/* Recommendations */}
                            {result.recommendations && result.recommendations.length > 0 && (
                                <div>
                                    <h3 className="font-semibold mb-2">Recommendations</h3>
                                    <ul className="list-disc list-inside text-sm space-y-1">
                                        {result.recommendations.map((rec: string, i: number) => (
                                            <li key={i}>{rec}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Step Details */}
                            <div>
                                <h3 className="font-semibold mb-2">Agent Steps</h3>
                                <ScrollArea className="h-[300px] rounded-md border p-4">
                                    <div className="space-y-4">
                                        {result.steps?.map((step: any, i: number) => (
                                            <div key={i} className="border-b pb-4 last:border-0 last:pb-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm">{step.name || step.tool || `Step ${i+1}`}</span>
                                                    <Badge variant="outline" className="text-xs">{step.status || "completed"}</Badge>
                                                </div>
                                                <div className="bg-muted p-2 rounded text-xs font-mono overflow-x-auto">
                                                    {typeof step.output === 'string' ? step.output : JSON.stringify(step.output, null, 2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                             {/* Raw Logs */}
                             <div>
                                <h3 className="font-semibold mb-2 text-muted-foreground text-xs uppercase">System Logs</h3>
                                <ScrollArea className="h-[150px] rounded-md border bg-black text-white p-4 font-mono text-xs">
                                    {result.logs?.map((log: string, i: number) => (
                                        <div key={i} className="mb-1 opacity-80">
                                            <span className="text-green-400 mr-2">$</span>{log}
                                        </div>
                                    ))}
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}



