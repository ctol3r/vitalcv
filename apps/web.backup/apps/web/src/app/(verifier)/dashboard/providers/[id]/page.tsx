'use client';

/**
 * Provider Detail View (Verifier Mode)
 * A verifier's x-ray of a clinician's entire credential set
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  ExternalLink,
  Download,
  Search,
  Link2,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type {
  CredentialDetail,
  NCQAVerificationMatrix,
  PSVEvidencePack,
} from '@/lib/verifier-dashboard-types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ProviderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const providerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<any>(null);
  const [credentials, setCredentials] = useState<CredentialDetail[]>([]);
  const [ncqaMatrix, setNcqaMatrix] = useState<NCQAVerificationMatrix | null>(null);
  const [evidencePack, setEvidencePack] = useState<PSVEvidencePack | null>(null);
  const [sanctions, setSanctions] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [providerRes, credentialsRes, ncqaRes, evidenceRes, sanctionsRes] = await Promise.all([
          fetch(`${API_BASE}/api/verifier/dashboard/providers/${providerId}`),
          fetch(`${API_BASE}/api/verifier/dashboard/providers/${providerId}/credentials`),
          fetch(`${API_BASE}/api/verifier/dashboard/providers/${providerId}/ncqa-matrix`),
          fetch(`${API_BASE}/api/verifier/dashboard/providers/${providerId}/evidence-pack`),
          fetch(`${API_BASE}/api/verifier/dashboard/providers/${providerId}/sanctions`),
        ]);

        if (providerRes.ok) {
          setProvider(await providerRes.json());
        }
        if (credentialsRes.ok) {
          const data = await credentialsRes.json();
          setCredentials(data.credentials || []);
        }
        if (ncqaRes.ok) {
          setNcqaMatrix(await ncqaRes.json());
        }
        if (evidenceRes.ok) {
          setEvidencePack(await evidenceRes.json());
        }
        if (sanctionsRes.ok) {
          setSanctions(await sanctionsRes.json());
        }
      } catch (error) {
        console.error('Failed to fetch provider data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (providerId) {
      void fetchData();
    }
  }, [providerId]);

  const handleVerifyCredential = async (credentialId: string) => {
    try {
      const response = await fetch(
        `/api/verifier/dashboard/verify-credential/${credentialId}`,
        { method: 'POST' },
      );
      if (response.ok) {
        // Refresh credentials
        const credentialsRes = await fetch(
          `${API_BASE}/api/verifier/dashboard/providers/${providerId}/credentials`,
        );
        if (credentialsRes.ok) {
          const data = await credentialsRes.json();
          setCredentials(data.credentials || []);
        }
      }
    } catch (error) {
      console.error('Failed to verify credential:', error);
    }
  };

  const handleOpenCredential = (credentialId: string) => {
    router.push(`/verifier/dashboard/credentials/${credentialId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <Skeleton className="h-12 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Provider List
        </Button>
        <h1 className="text-3xl font-bold">{provider?.name || 'Provider Details'}</h1>
        <p className="text-muted-foreground mt-2">
          Clinician ID: {provider?.clinicianId || providerId}
        </p>
      </div>

      <Tabs defaultValue="credentials" className="space-y-6">
        <TabsList>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="ncqa">NCQA Matrix</TabsTrigger>
          <TabsTrigger value="evidence">PSV Evidence</TabsTrigger>
          <TabsTrigger value="sanctions">Sanctions & OIG</TabsTrigger>
          <TabsTrigger value="timeline">Chain Timeline</TabsTrigger>
        </TabsList>

        {/* Credentials Tab */}
        <TabsContent value="credentials">
          <CredentialTable
            credentials={credentials}
            onVerify={handleVerifyCredential}
            onOpen={handleOpenCredential}
          />
        </TabsContent>

        {/* NCQA Matrix Tab */}
        <TabsContent value="ncqa">
          <NCQAMatrixView matrix={ncqaMatrix} />
        </TabsContent>

        {/* PSV Evidence Tab */}
        <TabsContent value="evidence">
          <PSVEvidenceView evidencePack={evidencePack} />
        </TabsContent>

        {/* Sanctions & OIG Tab */}
        <TabsContent value="sanctions">
          <SanctionsOIGView sanctions={sanctions} providerId={providerId} />
        </TabsContent>

        {/* Chain Timeline Tab */}
        <TabsContent value="timeline">
          <ChainTimelineView providerId={providerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CredentialTable({
  credentials,
  onVerify,
  onOpen,
}: {
  credentials: CredentialDetail[];
  onVerify: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const getComplianceBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      valid: 'default',
      expiring: 'secondary',
      expired: 'destructive',
      missing: 'outline',
      flagged: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credential Table</CardTitle>
        <CardDescription>
          Complete credential set with expiration, anchor status, and compliance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {credentials.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No credentials found</p>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => (
              <div key={cred.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{cred.type}</h3>
                    <p className="text-sm text-muted-foreground">
                      {cred.expiration
                        ? `Expires: ${new Date(cred.expiration).toLocaleDateString()}`
                        : 'No expiration'}
                    </p>
                  </div>
                  {getComplianceBadge(cred.complianceSummary)}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Anchor Status:</span>
                    <div className="flex items-center gap-2 mt-1">
                      {cred.anchorStatus.anchored ? (
                        <>
                          <Link2 className="h-4 w-4 text-emerald-600" />
                          <span className="font-mono text-xs">
                            {cred.anchorStatus.txHash?.slice(0, 16)}...
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not anchored</span>
                      )}
                      {cred.anchorStatus.stale && (
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3 mr-1" />
                          Stale
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Issuer Trust:</span>
                    <div className="mt-1">
                      <Badge variant="outline">{cred.issuerTrust}%</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => onOpen(cred.id)} variant="outline" size="sm">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Credential
                  </Button>
                  <Button onClick={() => onVerify(cred.id)} size="sm">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Verify Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NCQAMatrixView({ matrix }: { matrix: NCQAVerificationMatrix | null }) {
  if (!matrix) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          NCQA Verification Matrix not available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>NCQA Verification Matrix</CardTitle>
        <CardDescription>
          Source documents and timestamps for compliance auditing
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {matrix.credentials.map((cred, idx) => (
            <div key={idx} className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{cred.type}</h3>
                <Badge variant={cred.status === 'verified' ? 'default' : 'secondary'}>
                  {cred.status}
                </Badge>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Source:</span> {cred.sourceDocument}
                </p>
                <p>
                  <span className="text-muted-foreground">Verified:</span>{' '}
                  {new Date(cred.verificationTimestamp).toLocaleString()}
                </p>
                <p>
                  <span className="text-muted-foreground">By:</span> {cred.verifiedBy}
                </p>
                <p className="font-mono text-xs">
                  Chain: {cred.chainHash.slice(0, 16)}...{cred.chainHash.slice(-8)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-muted-foreground">
          Last updated: {new Date(matrix.lastUpdated).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}

function PSVEvidenceView({ evidencePack }: { evidencePack: PSVEvidencePack | null }) {
  if (!evidencePack) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          PSV Evidence Pack not available
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>PSV Evidence Pack</CardTitle>
        <CardDescription>Primary Source Verification evidence collection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {evidencePack.credentials.map((cred, idx) => (
            <div key={idx} className="rounded-lg border p-4">
              <h3 className="font-semibold mb-3">{cred.type}</h3>
              <div className="space-y-2">
                {cred.evidence.map((ev, evIdx) => (
                  <div key={evIdx} className="flex items-center justify-between rounded border p-2">
                    <div>
                      <Badge variant="outline">{ev.type}</Badge>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(ev.timestamp).toLocaleString()}
                      </p>
                      {ev.hash && (
                        <p className="font-mono text-xs mt-1">
                          {ev.hash.slice(0, 16)}...{ev.hash.slice(-8)}
                        </p>
                      )}
                    </div>
                    {ev.url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={ev.url} target="_blank" rel="noopener noreferrer">
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SanctionsOIGView({
  sanctions,
  providerId,
}: {
  sanctions: any;
  providerId: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/verifier/dashboard/providers/${providerId}/sanctions?refresh=true`,
        { method: 'POST' },
      );
      if (response.ok) {
        const data = await response.json();
        setSanctions(data);
      }
    } catch (error) {
      console.error('Failed to lookup sanctions:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Sanctions & OIG Lookups
        </CardTitle>
        <CardDescription>
          Office of Inspector General and sanctions database checks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleLookup} disabled={loading} variant="outline">
          <Search className="mr-2 h-4 w-4" />
          {loading ? 'Checking...' : 'Run Sanctions & OIG Lookup'}
        </Button>

        {sanctions && (
          <div className="space-y-4">
            {/* OIG Check */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">OIG Exclusion Check</h3>
                {sanctions.oig.checked ? (
                  sanctions.oig.matches.length > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {sanctions.oig.matches.length} Match(es)
                    </Badge>
                  ) : (
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Clear
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline">Not Checked</Badge>
                )}
              </div>
              {sanctions.oig.checked && sanctions.oig.matches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {sanctions.oig.matches.map((match: any, idx: number) => (
                    <div key={idx} className="text-sm text-red-600">
                      {match.reason || 'Match found in OIG database'}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sanctions Check */}
            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">Sanctions Database Check</h3>
                {sanctions.sanctions.checked ? (
                  sanctions.sanctions.matches.length > 0 ? (
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {sanctions.sanctions.matches.length} Match(es)
                    </Badge>
                  ) : (
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Clear
                    </Badge>
                  )
                ) : (
                  <Badge variant="outline">Not Checked</Badge>
                )}
              </div>
              {sanctions.sanctions.checked && sanctions.sanctions.matches.length > 0 && (
                <div className="mt-2 space-y-1">
                  {sanctions.sanctions.matches.map((match: any, idx: number) => (
                    <div key={idx} className="text-sm text-red-600">
                      {match.reason || 'Match found in sanctions database'}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChainTimelineView({ providerId }: { providerId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/api/verifier/dashboard/providers/${providerId}/timeline`,
        );
        if (response.ok) {
          const data = await response.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error('Failed to fetch timeline:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchTimeline();
  }, [providerId]);

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chain-of-Truth Timeline</CardTitle>
        <CardDescription>
          Complete history of credential changes and chain updates
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No timeline events</p>
        ) : (
          <div className="space-y-4">
            {events.map((event, idx) => (
              <div key={idx} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                  {idx < events.length - 1 && <div className="h-full w-0.5 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{event.type}</h3>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                  {event.txHash && (
                    <p className="font-mono text-xs mt-2">
                      TX: {event.txHash.slice(0, 16)}...{event.txHash.slice(-8)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

