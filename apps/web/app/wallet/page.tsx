'use client';

import { AccessLog, type AccessLogEntry } from '@/components/AccessLog';
import { DarkModeToggle } from '@/components/DarkModeToggle';
import { RevocationTimeline } from '@/components/RevocationTimeline';
import { RoleSwitcher } from '@/components/RoleSwitcher';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useSession } from '@/contexts/SessionContext';
import { useToast } from '@/hooks/use-toast';
import { getAllCredentials, saveCredential, StoredCredential } from '@/lib/credential-storage';
import { OidcClient } from '@/lib/oidc4vci-client';
import {
  buildPresentationRequestPayload,
  decodeJwtPayloadUnverified,
  listDisclosableClaims,
} from '@/lib/selective-disclosure';
import { Copy, Loader2, Plus, RefreshCw, Shield, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function WalletPage() {
  const [credentials, setCredentials] = useState<StoredCredential[]>([]);
  const { session } = useSession();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedCredential, setSelectedCredential] = useState<string | null>(null);
  const [selectedClaimPaths, setSelectedClaimPaths] = useState<string[]>([]);

  // Placeholder access logs - would normally come from local storage or backend sync
  const [accessLogEntries, setAccessLogEntries] = useState<AccessLogEntry[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      const stored = await getAllCredentials();
      setCredentials(stored);

      // Auto-refresh status for active credentials
      if (stored.length > 0) {
        refreshCredentialStatus(stored);
      }
    } catch (error) {
      console.error('Failed to load credentials:', error);
      toast({
        title: 'Error',
        description: 'Failed to load credentials from wallet storage',
        variant: 'destructive',
      });
    }
  };

  const refreshCredentialStatus = async (creds: StoredCredential[]) => {
    setRefreshing(true);
    const updates: StoredCredential[] = [];

    for (const cred of creds) {
      if (cred.status === 'revoked' || cred.status === 'expired') continue;

      try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
        const response = await fetch(
          `${backendUrl}/verifier/credential/${encodeURIComponent(cred.id)}/status`,
        );
        if (response.ok) {
          const statusData = await response.json();
          if (statusData.status !== cred.status) {
            updates.push({ ...cred, status: statusData.status });
          }
        }
      } catch (e) {
        console.warn(`Failed to check status for ${cred.id}`, e);
      }
    }

    if (updates.length > 0) {
      for (const update of updates) {
        await saveCredential(update);
      }
      setCredentials(await getAllCredentials());
      toast({
        title: 'Status Updated',
        description: `Updated status for ${updates.length} credential(s).`,
      });
    }
    setRefreshing(false);
  };

  const handleRequestCredential = async () => {
    setLoading(true);
    try {
      // 1. Initiate: Get pre-authorized code from backend (simulating out-of-band offer)
      const initiateResp = await fetch('/api/wallet/initiate-issuance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectDid: session?.userId || 'did:key:zTest',
          credentialType: 'SDJWTPhysicianCredential',
        }),
      });

      if (!initiateResp.ok) throw new Error('Failed to initiate issuance');
      const { pre_authorized_code } = await initiateResp.json();

      // 2. Client-side OIDC4VCI flow
      const client = new OidcClient();
      const issuerUrl =
        process.env.NEXT_PUBLIC_OIDC4VCI_ISSUER_URL || 'http://localhost:4001/oidc4vci';

      // Exchange code for token
      const tokenResponse = await client.exchangePreAuthCode(issuerUrl, pre_authorized_code);

      // Request credential
      const credentialResponse = await client.requestCredential(
        issuerUrl,
        tokenResponse.access_token,
        tokenResponse.c_nonce,
        'vc+sd-jwt',
      );

      // 3. Store Credential
      const now = new Date();
      const newCred: StoredCredential = {
        id: credentialResponse.credentialId || `CRED-${now.getTime()}`,
        type: 'SD-JWT Physician Credential',
        issuer: 'VitalCV Issuer',
        issuedAt: now.toISOString(),
        credential: credentialResponse.credential, // The SD-JWT string
        format: 'vc+sd-jwt',
        status: 'active',
        // Pre-parse claims for easier display if possible, or parse on fly
      };

      await saveCredential(newCred);
      await loadCredentials();

      toast({
        title: 'Credential Issued',
        description: 'Successfully requested and stored new credential.',
      });
    } catch (error) {
      console.error('Issuance failed:', error);
      toast({
        title: 'Issuance Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedClaimPaths([]);
  }, [selectedCredential]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'active':
      case 'valid':
        return { color: 'bg-green-100 text-green-800', label: 'Active' };
      case 'revoked':
        return { color: 'bg-red-100 text-red-800', label: 'Revoked' };
      case 'expired':
        return { color: 'bg-yellow-100 text-yellow-800', label: 'Expired' };
      default:
        return { color: 'bg-gray-100 text-gray-800', label: 'Unknown' };
    }
  };

  const selectedCredentialRecord = selectedCredential
    ? credentials.find((c) => c.id === selectedCredential) ?? null
    : null;

  // For SD-JWT, the "jwt" is the credential string itself (compact SD-JWT)
  // Our decode utility handles basic JWT decoding. For SD-JWT, the payload is the first part.
  const decodedPayload = selectedCredentialRecord?.credential
    ? decodeJwtPayloadUnverified(selectedCredentialRecord.credential)
    : null;

  const disclosableClaims = decodedPayload ? listDisclosableClaims(decodedPayload) : [];
  const selectedCount = selectedClaimPaths.length;

  const presentationRequestPayload =
    selectedCredential && decodedPayload
      ? buildPresentationRequestPayload({
          credentialId: selectedCredential,
          payload: decodedPayload,
          selectedClaimPaths,
        })
      : null;

  const presentationRequestJson = presentationRequestPayload
    ? JSON.stringify(presentationRequestPayload, null, 2)
    : '';

  const toggleClaim = (path: string, checked: boolean) => {
    setSelectedClaimPaths((prev) => {
      const has = prev.includes(path);
      if (checked) return has ? prev : [...prev, path].sort((a, b) => a.localeCompare(b));
      return has ? prev.filter((p) => p !== path) : prev;
    });
  };

  const clearAllClaims = () => setSelectedClaimPaths([]);
  const selectAllClaims = () => setSelectedClaimPaths(disclosableClaims.map((c) => c.path));

  const copyPresentationPayload = async () => {
    if (!presentationRequestJson) return;
    try {
      await navigator.clipboard.writeText(presentationRequestJson);
      toast({
        title: 'Copied',
        description: 'Presentation payload copied to clipboard',
      });
    } catch (error) {
      console.error('Failed to copy presentation payload:', error);
      toast({
        title: 'Copy failed',
        description: 'Unable to copy payload. Please copy it manually.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>

      <header className="border-b bg-white/80 backdrop-blur-sm" role="banner">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" aria-hidden="true" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav
            className="hidden md:flex items-center space-x-6"
            role="navigation"
            aria-label="Main navigation"
          >
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/issuer" className="text-gray-600 hover:text-blue-600 transition-colors">
              Issuer
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link
              href="/wallet/access-log"
              className="text-gray-600 hover:text-blue-600 transition-colors"
            >
              Access Log
            </Link>
            {session && session.roles.length > 1 && <RoleSwitcher availableRoles={session.roles} />}
            <DarkModeToggle />
          </nav>
        </div>
      </header>

      <main id="main-content" className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-gray-900">My Wallet</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => refreshCredentialStatus(credentials)}
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Status
              </Button>
              <Button onClick={handleRequestCredential} disabled={loading}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Request Credential
              </Button>
            </div>
          </div>
          <p className="text-lg text-gray-600">
            Manage your verifiable credentials and access history
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" aria-hidden="true" />
                  My Credentials
                </CardTitle>
                <CardDescription>
                  {credentials.length} credential{credentials.length !== 1 ? 's' : ''} in your
                  wallet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {credentials.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No credentials found.</p>
                      <p className="text-sm">Click "Request Credential" to get started.</p>
                    </div>
                  ) : (
                    credentials.map((credential) => {
                      const statusConfig = getStatusConfig(credential.status || 'unknown');
                      const isSelected = selectedCredential === credential.id;
                      const buttonClassName = `w-full text-left p-4 border-2 rounded-lg transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-blue-300'
                      }`;
                      const buttonContent = (
                        <>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-lg">{credential.type}</h3>
                            <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>ID:</strong> <code className="text-xs">{credential.id}</code>
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Issuer:</strong> {credential.issuer}
                          </p>
                          <p className="text-sm text-gray-600">
                            <strong>Issued:</strong>{' '}
                            {new Date(credential.issuedAt).toLocaleDateString()}
                          </p>
                        </>
                      );

                      return isSelected ? (
                        <button
                          key={credential.id}
                          onClick={() => setSelectedCredential(credential.id)}
                          className={buttonClassName}
                          aria-pressed="true"
                        >
                          {buttonContent}
                        </button>
                      ) : (
                        <button
                          key={credential.id}
                          onClick={() => setSelectedCredential(credential.id)}
                          className={buttonClassName}
                          aria-pressed="false"
                        >
                          {buttonContent}
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div>
            <div className="space-y-4">
              <Tabs defaultValue="timeline" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="timeline">Timeline</TabsTrigger>
                  <TabsTrigger value="access">Access Log</TabsTrigger>
                </TabsList>

                <TabsContent value="timeline">
                  <RevocationTimeline
                    credentialId={selectedCredential || 'Select a credential'}
                    isOpen={true}
                    onToggle={() => {}}
                  />
                </TabsContent>

                <TabsContent value="access">
                  <AccessLog entries={accessLogEntries} />
                </TabsContent>
              </Tabs>

              <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Selective disclosure</CardTitle>
                  <CardDescription>
                    Choose which claims to include when you present this credential. Unselected
                    claims will be omitted from the payload you share.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedCredential ? (
                    <p className="text-sm text-gray-600">
                      Select a credential to review its claims and generate a presentation payload.
                    </p>
                  ) : !decodedPayload ? (
                    <Alert variant="destructive">
                      <AlertDescription>Could not parse credential payload.</AlertDescription>
                    </Alert>
                  ) : (
                    <>
                      <Alert>
                        <AlertDescription>
                          <p>
                            <strong>Privacy note:</strong> Sharing more claims increases exposure.
                            Only select what the verifier needs. Your credential ID is always
                            included to identify the credential.
                          </p>
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm text-muted-foreground">
                          {selectedCount} selected • {disclosableClaims.length} available
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={clearAllClaims}
                            disabled={selectedCount === 0}
                          >
                            Clear
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={selectAllClaims}
                            disabled={disclosableClaims.length === 0}
                          >
                            Select all
                          </Button>
                        </div>
                      </div>

                      {selectedCount === 0 && (
                        <Alert>
                          <AlertDescription>
                            No claims selected. Your presentation payload will include only the
                            credential ID.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="max-h-64 overflow-auto rounded-lg border bg-white">
                        <div className="divide-y">
                          {disclosableClaims.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground">
                              No disclosable claims found in this credential.
                            </div>
                          ) : (
                            disclosableClaims.map((claim) => {
                              const checked = selectedClaimPaths.includes(claim.path);
                              return (
                                <div
                                  key={claim.path}
                                  className="flex items-start justify-between gap-4 p-3"
                                >
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900">
                                      {claim.label}
                                    </p>
                                    <p className="text-xs text-muted-foreground break-all">
                                      {claim.valuePreview}
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground font-mono break-all">
                                      {claim.path}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Label className="sr-only" htmlFor={`claim-${claim.path}`}>
                                      Toggle {claim.label}
                                    </Label>
                                    <Switch
                                      id={`claim-${claim.path}`}
                                      checked={checked}
                                      onCheckedChange={(nextChecked) =>
                                        toggleClaim(claim.path, Boolean(nextChecked))
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="presentation-payload">
                            Presentation request payload (JSON)
                          </Label>
                          <Button
                            type="button"
                            size="sm"
                            onClick={copyPresentationPayload}
                            disabled={!presentationRequestJson}
                          >
                            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                            Copy
                          </Button>
                        </div>
                        <Textarea
                          id="presentation-payload"
                          readOnly
                          value={presentationRequestJson}
                          className="font-mono text-xs min-h-[180px]"
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
