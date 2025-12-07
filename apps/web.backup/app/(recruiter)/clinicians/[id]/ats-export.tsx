'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

interface AtsExportPanelProps {
  clinicianId: string;
  orgId?: string;
  webhookId?: string;
}

interface ExportResponse {
  status: string;
  webhookId: string;
  payloadHash: string;
  deliveredAt: string;
  responseStatus?: number;
}

export function AtsExportPanel({ clinicianId, orgId, webhookId }: AtsExportPanelProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResponse, setLastResponse] = useState<ExportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendPacket = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/ats/export/${clinicianId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgId, webhookId }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message ?? payload?.error ?? res.statusText);
      }

      const payload = (await res.json()) as ExportResponse;
      setLastResponse(payload);
      toast({
        title: 'FHIR applicant packet sent',
        description: `ATS acknowledged delivery (hash ${payload.payloadHash.slice(0, 8)}…)`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      toast({
        title: 'ATS delivery failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-dashed border-slate-200 p-4 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-900">Send FHIR Applicant Packet</p>
          <p className="text-sm text-muted-foreground">
            Streams Practitioner + VerificationResult bundle to your ATS webhook.
          </p>
        </div>
        <Button onClick={sendPacket} disabled={isSubmitting} className="gap-2">
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {isSubmitting ? 'Sending…' : 'Send Packet'}
        </Button>
      </div>

      {lastResponse && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Delivered {new Date(lastResponse.deliveredAt).toLocaleString()}
          </Badge>
          <span className="text-slate-500">
            Response {lastResponse.responseStatus ?? 202} • Hash{' '}
            <code className="text-xs">{lastResponse.payloadHash.slice(0, 16)}…</code>
          </span>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600" data-test-id="ats-export-error">
          {error}
        </p>
      )}
    </Card>
  );
}

export default AtsExportPanel;











