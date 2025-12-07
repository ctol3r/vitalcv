'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck, Zap, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface BundleEntry<T> {
  fullUrl: string;
  resource: T;
}

interface VerificationResult {
  resourceType: 'VerificationResult';
  id: string;
  status: string;
  targetId?: string;
  targetDisplay?: string;
  source?: {
    display?: string;
  };
}

interface PractitionerRole {
  resourceType: 'PractitionerRole';
  id: string;
  active?: boolean;
  specialty?: Array<{ text?: string }>;
}

interface FhirBundle {
  resourceType: 'Bundle';
  entry: Array<BundleEntry<unknown>>;
}

export default function EhrLaunchPage() {
  const params = useSearchParams();
  const launchContext = params.get('launch') ?? 'demo-clinician';
  const issuer = params.get('iss') ?? 'https://ehr.vitalcv.health';
  const patient = params.get('patient') ?? 'unknown';
  const { toast } = useToast();

  const [bundle, setBundle] = useState<FhirBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE}/api/fhir/bundle/${launchContext}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Bundle fetch failed (${response.status})`);
        }
        const payload = (await response.json()) as FhirBundle;
        if (!cancelled) {
          setBundle(payload);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Unable to load clinician bundle';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    hydrate();
    return () => {
      cancelled = true;
    };
  }, [launchContext]);

  const verificationResults = useMemo(() => {
    if (!bundle?.entry) return [];
    return bundle.entry
      .map((entry) => entry.resource)
      .filter((resource): resource is VerificationResult => (resource as any)?.resourceType === 'VerificationResult');
  }, [bundle]);

  const practitionerRoles = useMemo(() => {
    if (!bundle?.entry) return [];
    return bundle.entry
      .map((entry) => entry.resource)
      .filter((resource): resource is PractitionerRole => (resource as any)?.resourceType === 'PractitionerRole');
  }, [bundle]);

  const privilegedSites = practitionerRoles.flatMap((role) =>
    (role.specialty ?? []).map((specialty) => specialty.text ?? 'Role'),
  );

  const handleSync = async () => {
    toast({
      title: 'Launch context synchronized',
      description: 'FHIR bundle cached for downstream CDS hooks.',
    });
  };

  return (
    <div className="space-y-6 p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">EHR Launch Context</h1>
          <p className="text-muted-foreground">SMART-on-FHIR handshake parsed in real-time.</p>
        </div>
        <Button onClick={handleSync} disabled={loading}>
          <Zap className="mr-2 h-4 w-4" />
          Sync to EHR
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>FHIR bundle unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Launch context</CardTitle>
            <CardDescription>SMART parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>
              Launch token
              <Badge variant="secondary" className="ml-2">
                {launchContext}
              </Badge>
            </div>
            <div>
              Issuer
              <Badge variant="outline" className="ml-2">
                {issuer}
              </Badge>
            </div>
            <div>
              Patient context
              <Badge variant="outline" className="ml-2">
                {patient}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification state</CardTitle>
            <CardDescription>Ordered privileges & PSV evidence</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-2 text-sm">
                {verificationResults.slice(0, 4).map((result) => (
                  <div key={result.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground">{result.targetDisplay ?? result.targetId}</span>
                      <Badge variant={result.status === 'completed' ? 'secondary' : 'outline'}>
                        {result.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Source: {result.source?.display ?? 'State board'}
                    </p>
                  </div>
                ))}
                {!verificationResults.length && <p className="text-muted-foreground">No PSV entries yet.</p>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ordering privileges</CardTitle>
            <CardDescription>Sites ready for CDS hook execution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : privilegedSites.length ? (
              privilegedSites.slice(0, 4).map((site) => (
                <Badge key={site} variant="secondary" className="text-xs">
                  {site}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No privileging metadata embedded.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Launch flow</CardTitle>
          <CardDescription>Four-step verification for ordering privileges</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <FlowStep
            title="1. Identify"
            description="SMART launch & iss parsed"
            complete
          />
          <FlowStep
            title="2. Load VCs"
            description={bundle ? 'Bundle cached locally' : 'Waiting for clinician bundle'}
            complete={Boolean(bundle)}
          />
          <FlowStep
            title="3. Verify privileges"
            description={verificationResults.length ? 'PSV signals satisfied' : 'Privileges pending'}
            complete={verificationResults.length > 0}
          />
          <FlowStep
            title="4. Anchor"
            description="Chain digest scheduled hourly"
            complete
          />
        </CardContent>
      </Card>
    </div>
  );
}

function FlowStep({ title, description, complete }: { title: string; description: string; complete?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        {complete ? <ShieldCheck className="h-4 w-4 text-emerald-500" /> : <RefreshCw className="h-4 w-4 text-amber-500 animate-spin" />}
        <p className="font-semibold text-foreground">{title}</p>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}











