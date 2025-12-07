'use client';

import { AIDecisionLog } from '@/lib/admin/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  Shield,
  Eye,
} from 'lucide-react';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AIDecisionDetailPanelProps {
  log: AIDecisionLog;
  onOverride: (decisionId: string, override: 'safe' | 'escalate' | 'ignore', reason: string) => Promise<void>;
  onClose: () => void;
}

export function AIDecisionDetailPanel({ log, onOverride, onClose }: AIDecisionDetailPanelProps) {
  const [overrideType, setOverrideType] = useState<'safe' | 'escalate' | 'ignore'>('safe');
  const [overrideReason, setOverrideReason] = useState('');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'credential_anomaly':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'skill_flag':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'compliance_notice':
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
      case 'fraud_detection':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Brain className="h-5 w-5" />;
    }
  };

  const handleOverride = async () => {
    if (!overrideReason.trim()) return;
    await onOverride(log.id, overrideType, overrideReason);
    setOverrideReason('');
  };

  return (
    <Card className="sticky top-8">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getTypeIcon(log.type)}
            <div>
              <CardTitle className="capitalize">{log.type.replace(/_/g, ' ')}</CardTitle>
              <CardDescription>
                {log.resourceType} • {log.resourceId}
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Decision */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Decision</h3>
          <p className="text-sm">{log.decision}</p>
        </div>

        {/* Reasoning */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Reasoning</h3>
          <p className="text-sm text-muted-foreground">{log.reasoning}</p>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Confidence</span>
            <span className="text-sm font-semibold">{Math.round(log.confidence * 100)}%</span>
          </div>
          <Progress value={log.confidence * 100} className="h-2" />
        </div>

        {/* Review Status */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Review Status</span>
            {log.reviewed ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Reviewed
              </Badge>
            ) : (
              <Badge variant="secondary">Unreviewed</Badge>
            )}
          </div>
          {log.reviewed && log.reviewedBy && (
            <p className="text-xs text-muted-foreground">
              Reviewed by {log.reviewedBy} on{' '}
              {log.reviewedAt ? new Date(log.reviewedAt).toLocaleString() : 'N/A'}
            </p>
          )}
        </div>

        {/* Override Status */}
        {log.override && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Override</span>
              <Badge variant="outline" className="capitalize">
                {log.override}
              </Badge>
            </div>
          </div>
        )}

        <Separator />

        {/* Override Actions */}
        {!log.override && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">AI Override</h3>

            <div>
              <Label htmlFor="override-type">Override Type</Label>
              <Select value={overrideType} onValueChange={(v: any) => setOverrideType(v)}>
                <SelectTrigger id="override-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="safe">Mark Safe</SelectItem>
                  <SelectItem value="escalate">Escalate</SelectItem>
                  <SelectItem value="ignore">Ignore</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="override-reason">Reason</Label>
              <Input
                id="override-reason"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="Explain why you're overriding this decision..."
              />
            </div>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="w-full"
                  variant={overrideType === 'safe' ? 'default' : overrideType === 'escalate' ? 'destructive' : 'secondary'}
                  disabled={!overrideReason.trim()}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Apply Override
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Override</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to {overrideType} this AI decision? This action will be
                    logged and audited.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleOverride}>
                    Confirm Override
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Metadata */}
        <div className="pt-4 border-t space-y-1 text-xs text-muted-foreground">
          <p>Timestamp: {new Date(log.timestamp).toLocaleString()}</p>
          <p>Decision ID: {log.id}</p>
          {log.metadata && (
            <details className="mt-2">
              <summary className="cursor-pointer">View Metadata</summary>
              <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

