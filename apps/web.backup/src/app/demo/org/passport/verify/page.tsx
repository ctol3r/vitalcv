'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  EyeOff,
  FileCheck2,
  Loader2,
  Radar,
  Shield,
  Upload,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface VerificationResult {
  verifiedClaims: { label: string; value: string; anchor: string }[];
  hiddenClaims: string[];
  trustAnchors: { name: string; type: string; status: 'trusted' | 'warning' }[];
  riskSignals: { title: string; detail: string; severity: 'info' | 'warning' | 'critical' }[];
}

const DEFAULT_SD_JWT =
  'eyJ0eXAiOiJKV1QiLCJmbXQiOiJzZC1ranciLCJhbGciOiJFZERTQSJ9.eyJpc3MiOiJvcmdBLXZpLWF1ZCIsImlhdCI6MTczMTI0NjA4MCwibmJmIjoxNzMxMjQ0ODgwLCJjbiI6ImNsaW5pY2lhbi1kZW1vLTAwMSIsImNsYWltcyI6eyJuYW1lIjoiRHJBLiBBdmEgQ29sZW1hbiIsIm5waS1zaGEiOiIwMHhjZGE4ZiIsInByaXZpbGVnZXMiOlsiRUQgU3RhdHVzIl0sImRlYSI6eyJudW0iOiJGQzc0MzY4MTciLCJzY2hlZHVsZXMiOlsiSVYiLCJWIl19fX0';

const demoResult: VerificationResult = {
  verifiedClaims: [
    { label: 'Full name', value: 'Dr. Ava Coleman', anchor: 'Vital issuer (Org A)' },
    { label: 'NPI hash', value: '0x00xda8f… (salted)', anchor: 'Vital /root/did:vital:demo' },
    {
      label: 'Privilege scope',
      value: 'Emergency medicine — independent',
      anchor: 'Org A committee signature',
    },
    { label: 'Controlled schedules', value: 'Schedules II – V', anchor: 'DEA API • Nov 10 2025' },
  ],
  hiddenClaims: ['Personal contact methods', 'Peer review attachments', 'Case log attachments'],
  trustAnchors: [
    { name: 'Vital issuer root', type: 'rootCA', status: 'trusted' },
    { name: 'NCI federation /orgA/signing', type: 'org', status: 'trusted' },
    { name: 'MobilityEngine signal attestor', type: 'service', status: 'warning' },
  ],
  riskSignals: [
    {
      title: 'Board recertification due in 21 days',
      detail: 'MobilityEngine flagged ABEM renewal window for Org B.',
      severity: 'warning',
    },
    {
      title: 'Org B packet missing OPPE summary',
      detail: 'Selective disclosure indicates OPPE doc withheld.',
      severity: 'info',
    },
  ],
};

const severityStyles: Record<string, string> = {
  info: 'bg-slate-100 text-slate-900',
  warning: 'bg-amber-100 text-amber-900',
  critical: 'bg-red-100 text-red-900',
};

export default function OrgPassportVerifierPage() {
  const [sdJwt, setSdJwt] = useState(DEFAULT_SD_JWT);
  const [result, setResult] = useState<VerificationResult>(demoResult);
  const [verifying, setVerifying] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hiddenCount = result.hiddenClaims.length;

  const verifyPassport = async () => {
    setVerifying(true);
    setToast(null);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setResult({
      ...demoResult,
      riskSignals:
        sdJwt.length > DEFAULT_SD_JWT.length
          ? demoResult.riskSignals
          : [
              {
                title: 'SD-JWT missing privileges array',
                detail: 'Parser could not locate `claims.privileges` path.',
                severity: 'critical',
              },
              ...demoResult.riskSignals,
            ],
    });
    setToast('Passport verified with Vital’s embedded rules.');
    setVerifying(false);
  };

  const parsedHeader = useMemo(() => {
    try {
      const [header] = sdJwt.split('.');
      return JSON.parse(atob(header));
    } catch {
      return null;
    }
  }, [sdJwt]);

  return (
    <div className="container mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
          Org verifier
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Passport verifier (Org B)</h1>
        <p className="text-muted-foreground">
          Paste or upload a selective-disclosure JWT. We display verified claims, hidden payloads,
          trust anchors, and MobilityEngine risk signals in one pane.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Upload or paste SD-JWT
            </CardTitle>
            <CardDescription>Supports vCSD-JWT with selective disclosure toggles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="passport-file" className="text-sm font-medium">
                Ingest from file
              </label>
              <Input
                id="passport-file"
                type="file"
                accept=".jwt,.sdjwt,.txt"
                aria-describedby="passport-file-help"
              />
              <p id="passport-file-help" className="text-xs text-muted-foreground">
                File contents stay local — demo simply parses the base64 payload for you.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="passport-textarea" className="text-sm font-medium">
                Or paste SD-JWT
              </label>
              <textarea
                id="passport-textarea"
                className="min-h-[140px] w-full rounded-md border border-border bg-transparent p-3 font-mono text-xs"
                value={sdJwt}
                onChange={(event) => setSdJwt(event.target.value)}
                spellCheck={false}
              />
              {parsedHeader && (
                <p className="text-xs text-muted-foreground">
                  Header:{' '}
                  <span className="font-mono">
                    alg={parsedHeader.alg} · typ={parsedHeader.typ} · fmt={parsedHeader.fmt}
                  </span>
                </p>
              )}
            </div>

            <Button onClick={verifyPassport} disabled={verifying} className="w-full" aria-live="polite">
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Verifying…
                </>
              ) : (
                <>
                  <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Verify passport
                </>
              )}
            </Button>

            {toast && (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
              >
                {toast}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card aria-label="Verified claims">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Verified claims
              </CardTitle>
              <CardDescription>Claims disclosed to Org B with anchored signatures.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.verifiedClaims.map((claim) => (
                <div key={claim.label} className="rounded-lg border border-border/60 p-3">
                  <p className="text-sm font-semibold">{claim.label}</p>
                  <p className="text-sm text-foreground">{claim.value}</p>
                  <p className="text-xs text-muted-foreground">Anchor: {claim.anchor}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card aria-label="Hidden claims">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-4 w-4" aria-hidden="true" />
                Hidden ({hiddenCount})
              </CardTitle>
              <CardDescription>Claims withheld via selective disclosure toggles.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {result.hiddenClaims.map((claim) => (
                <div key={claim} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  {claim}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-4 w-4" aria-hidden="true" />
              Trust anchors
            </CardTitle>
            <CardDescription>Every verification lists the trust chain the SD-JWT relied on.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.trustAnchors.map((anchor) => (
              <div
                key={anchor.name}
                className="flex items-center justify-between rounded-lg border border-border/60 p-3"
              >
                <div>
                  <p className="text-sm font-semibold">{anchor.name}</p>
                  <p className="text-xs text-muted-foreground">{anchor.type}</p>
                </div>
                <Badge variant={anchor.status === 'trusted' ? 'outline' : 'secondary'}>
                  {anchor.status === 'trusted' ? 'Trusted' : 'Warning'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-4 w-4" aria-hidden="true" />
              Risk signals
            </CardTitle>
            <CardDescription>Surfaced automatically via MobilityEngine scoring.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.riskSignals.map((signal) => (
              <div
                key={signal.title}
                className={`rounded-lg border border-border/70 p-3 text-sm ${
                  severityStyles[signal.severity]
                }`}
              >
                <p className="font-semibold">{signal.title}</p>
                <p className="text-xs">{signal.detail}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              MobilityEngine factors selective-disclosure telemetry, trust anchor freshness, and Org B
              policy to raise these signals.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
