/**
 * Credential Detail Page
 * Shows full credential details, proof data, and audit trail
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CredentialStatusBadge } from '@/components/wallet/CredentialStatusBadge';
import { ProvenancePanel } from '@/components/wallet/ProvenancePanel';
import { ShareCredentialModal } from '@/components/wallet/ShareCredentialModal';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CredentialDetail, getCredentialDetail } from '@/lib/wallet-api';
import {
  ArrowLeft,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Link as LinkIcon,
  Loader2,
  Share2,
  Shield,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function CredentialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [credential, setCredential] = useState<CredentialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exporting, setExporting] = useState<'apple' | 'google' | null>(null);
  const credentialId = params.credentialId as string;

  useEffect(() => {
    loadCredential();
  }, [credentialId]);

  const loadCredential = async () => {
    try {
      setLoading(true);
      const data = await getCredentialDetail(credentialId);
      setCredential(data);
    } catch (error) {
      console.error('Failed to load credential:', error);
      toast({
        title: 'Error',
        description: 'Failed to load credential details.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadProof = () => {
    if (!credential) return;
    const dataStr = JSON.stringify(credential.proofData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `proof-${credential.id}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();

    toast({
      title: 'Success',
      description: 'Proof downloaded successfully',
    });
  };

  const exportToAppleWallet = async () => {
    if (!credential) return;
    setExporting('apple');
    try {
      const response = await fetch('/api/wallet/export/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate Apple Wallet package.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const linkElement = document.createElement('a');
      linkElement.href = url;
      linkElement.download = `${credential.id}.pkpass`;
      document.body.appendChild(linkElement);
      linkElement.click();
      document.body.removeChild(linkElement);
      URL.revokeObjectURL(url);
      toast({
        title: 'Apple Wallet package ready',
        description: 'Import the .pkpass file to add this credential to Apple Wallet.',
      });
    } catch (error) {
      console.error('[wallet][export][apple]', error);
      toast({
        title: 'Apple Wallet export failed',
        description: error instanceof Error ? error.message : 'Unable to generate .pkpass bundle.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  const exportToGoogleWallet = async () => {
    if (!credential) return;
    setExporting('google');
    try {
      const response = await fetch('/api/wallet/export/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credentialId }),
      });
      if (!response.ok) {
        throw new Error('Failed to generate Google Wallet pass.');
      }
      const payload = await response.json();
      window.open(payload.saveUrl, '_blank', 'noopener,noreferrer');
      toast({
        title: 'Google Wallet pass ready',
        description: 'Follow the Google Wallet flow to finish adding this credential.',
      });
    } catch (error) {
      console.error('[wallet][export][google]', error);
      toast({
        title: 'Google Wallet export failed',
        description: error instanceof Error ? error.message : 'Unable to build JWT-based pass.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!credential) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Credential not found</h3>
            <p className="text-muted-foreground mb-6">
              The credential you're looking for doesn't exist or has been removed.
            </p>
            <Button asChild>
              <Link href="/wallet">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Wallet
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/wallet">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wallet
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-2xl">{credential.type}</CardTitle>
                    <CredentialStatusBadge
                      status={credential.status}
                      expiryDate={credential.expiresAt}
                      showTooltip={true}
                    />
                  </div>
                  <CardDescription>{credential.issuer.name}</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowShareModal(true)}
                    disabled={credential.status !== 'valid'}
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share
                  </Button>
                  {credential.proofData && (
                    <Button variant="outline" size="sm" onClick={downloadProof}>
                      <Download className="mr-2 h-4 w-4" />
                      Proof
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(`http://localhost:4000/api/compliance/export/ncqa/${credentialId}`, '_blank')}
                    title="Download Verification Evidence (NCQA)"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    NCQA Evidence
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToAppleWallet}
                    disabled={credential.status !== 'valid' || exporting === 'apple'}
                    title="Export to Apple Wallet"
                  >
                    {exporting === 'apple' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Apple Wallet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportToGoogleWallet}
                    disabled={credential.status !== 'valid' || exporting === 'google'}
                    title="Export to Google Wallet"
                  >
                    {exporting === 'google' ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Google Wallet
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground mb-1">Issued</div>
                  <div className="font-medium">{formatDate(credential.issuedAt)}</div>
                </div>
                {credential.expiresAt && (
                  <div>
                    <div className="text-muted-foreground mb-1">Expires</div>
                    <div className="font-medium">{formatDate(credential.expiresAt)}</div>
                  </div>
                )}
                <div className="col-span-2">
                  <div className="text-muted-foreground mb-1">Credential ID</div>
                  <code className="text-xs font-mono bg-muted px-2 py-1 rounded block">
                    {credential.id}
                  </code>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="claims" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="claims">Claims</TabsTrigger>
              <TabsTrigger value="audit">Audit Trail</TabsTrigger>
              <TabsTrigger value="raw">Raw Data</TabsTrigger>
            </TabsList>

            <TabsContent value="claims">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Claims
                  </CardTitle>
                  <CardDescription>Data contained in this credential</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(credential.subject.claims).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-start">
                        <div className="font-medium text-sm capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-sm text-right max-w-md">
                          {typeof value === 'object' ? (
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded block">
                              {JSON.stringify(value, null, 2)}
                            </code>
                          ) : (
                            <span className="font-mono">{String(value)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Audit Trail
                  </CardTitle>
                  <CardDescription>History of credential events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {credential.auditTrail.map((event, index) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              'w-8 h-8 rounded-full flex items-center justify-center',
                              event.type === 'issued' && 'bg-blue-100 text-blue-600',
                              event.type === 'verified' && 'bg-green-100 text-green-600',
                              event.type === 'revoked' && 'bg-red-100 text-red-600',
                            )}
                          >
                            {event.type === 'issued' && <Shield className="h-4 w-4" />}
                            {event.type === 'verified' && <Shield className="h-4 w-4" />}
                            {event.type === 'revoked' && <Shield className="h-4 w-4" />}
                          </div>
                          {index < credential.auditTrail.length - 1 && (
                            <div className="w-0.5 h-full bg-border my-1" />
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <div className="font-medium capitalize">{event.type}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(event.timestamp)}
                          </div>
                          {event.actor && (
                            <div className="text-sm text-muted-foreground mt-1">
                              by {event.actor}
                            </div>
                          )}
                          {event.details && <div className="text-sm mt-2">{event.details}</div>}
                          <Badge variant="outline" className="mt-2">
                            {event.auditRef}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="raw">
              <Card>
                <CardHeader>
                  <CardTitle>Raw Credential Data</CardTitle>
                  <CardDescription>Full credential in JSON format</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono max-h-96">
                    {JSON.stringify(credential, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Provenance Panel */}
          <ProvenancePanel
            data={{
              issuer: {
                ...credential.issuer,
                verifiedIssuer: true, // TODO: Get from API
              },
              proofData: credential.proofData
                ? {
                    ...credential.proofData,
                    explorerUrl: credential.proofLink,
                  }
                : undefined,
              issuedAt: credential.issuedAt,
              anchorMethod: credential.proofData ? 'substrate' : undefined,
            }}
          />

          {/* Schema */}
          {credential.schemaId && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Schema
                </CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-xs font-mono bg-muted px-2 py-1 rounded block truncate">
                  {credential.schemaId}
                </code>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Share Modal */}
      <ShareCredentialModal
        credential={credential}
        open={showShareModal}
        onOpenChange={setShowShareModal}
      />
    </div>
  );
}
