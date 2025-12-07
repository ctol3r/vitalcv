'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, Calendar, CheckCircle2, RefreshCw, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface AutomationRule {
  id: string;
  event: string;
  action: string;
  metadata: Record<string, unknown>;
}

interface RenewalPrediction {
  credentialId: string;
  predictedRenewalDate: string;
  confidence: number;
  boardCycle?: string;
}

export default function LifecycleAutomationPage() {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [predictions, setPredictions] = useState<RenewalPrediction[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setRules([]);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lifecycle Automation</h1>
          <p className="text-muted-foreground mt-2">
            End-to-end, self-updating credential management from creation → maintenance → expiry → renewal
          </p>
        </div>
        <Button onClick={fetchRules} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Automation Rules
            </CardTitle>
            <CardDescription>Configure lifecycle automation rules</CardDescription>
          </CardHeader>
          <CardContent>
            {rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No automation rules configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{rule.event}</TableCell>
                      <TableCell>{rule.action}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Renewal Predictions
            </CardTitle>
            <CardDescription>Predicted renewal deadlines based on history</CardDescription>
          </CardHeader>
          <CardContent>
            {predictions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No renewal predictions available</p>
            ) : (
              <div className="space-y-2">
                {predictions.map((pred) => (
                  <div key={pred.credentialId} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="text-sm font-medium">{pred.credentialId}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(pred.predictedRenewalDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant={pred.confidence > 0.8 ? 'default' : 'secondary'}>
                      {(pred.confidence * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Automation Status
          </CardTitle>
          <CardDescription>Current automation activity and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm">Automation Active</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm">0 Conflicts Detected</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}








