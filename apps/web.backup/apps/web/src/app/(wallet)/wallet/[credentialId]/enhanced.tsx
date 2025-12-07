/**
 * Enhanced Credential Detail View
 * Complete implementation with all 40 tasks
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCredentialDetail } from '@/lib/hooks/use-credential-detail';
import { CredentialHeader } from '@/components/credential-detail/CredentialHeader';
import { VerificationBanner } from '@/components/credential-detail/VerificationBanner';
import { MetadataGrid } from '@/components/credential-detail/MetadataGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EvidenceSection } from '@/components/credential-detail/EvidenceSection';
import { ChainAnchorSection } from '@/components/credential-detail/ChainAnchorSection';
import { TrustExplainerSheet } from '@/components/credential-detail/TrustExplainerSheet';
import { useState } from 'react';

export default function EnhancedCredentialDetailPage() {
  const params = useParams();
  const router = useRouter();
  const credentialId = params.credentialId as string;
  const { state, route, setRoute, refresh, loading } = useCredentialDetail({
    credentialId,
    autoLoad: true,
  });
  const [showTrustExplainer, setShowTrustExplainer] = useState(false);

  if (loading || state.type === 'loading') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (state.type === 'error') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Credential</h3>
            <p className="text-muted-foreground mb-6">{state.error}</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => refresh()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
              <Button variant="outline" asChild>
                <Link href="/wallet">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Wallet
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.type !== 'loaded') {
    return null;
  }

  const {
    credential,
    evidence,
    anchorStatus,
    trustScore,
    proofHealth,
    selectiveDisclosure,
    timeline,
  } = state;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Back Button */}
      <Button variant="ghost" asChild className="mb-6">
        <Link href="/wallet">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Wallet
        </Link>
      </Button>

      <div className="space-y-6">
        {/* Header */}
        <CredentialHeader credential={credential} trustScore={trustScore} />

        {/* Verification Banner */}
        <VerificationBanner credential={credential} anchorStatus={anchorStatus} />

        {/* Main Content Tabs */}
        <Tabs value={route} onValueChange={(v) => setRoute(v as any)}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="evidence">Evidence</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="chain">Chain</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Metadata Grid */}
            <MetadataGrid
              credential={credential}
              selectiveDisclosure={selectiveDisclosure}
            />

            {/* Trust & Proof Health */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Proof Health</h3>
                    <span className="text-2xl font-bold">
                      {(proofHealth.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="space-y-2">
                    {proofHealth.strengths.map((strength, i) => (
                      <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-emerald-600">✓</span>
                        {strength}
                      </div>
                    ))}
                    {proofHealth.missing.map((missing, i) => (
                      <div key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="text-amber-600">⚠</span>
                        {missing}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Trust Breakdown</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTrustExplainer(true)}
                    >
                      Why trusted?
                    </Button>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issuer</span>
                      <span className="font-medium">
                        {(trustScore.breakdown.issuer * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Anchor</span>
                      <span className="font-medium">
                        {(trustScore.breakdown.anchor * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Evidence</span>
                      <span className="font-medium">
                        {(trustScore.breakdown.evidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Freshness</span>
                      <span className="font-medium">
                        {(trustScore.breakdown.freshness * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="evidence">
            <EvidenceSection
              evidence={evidence}
              credentialId={credentialId}
            />
          </TabsContent>

          <TabsContent value="timeline">
            <ChainAnchorSection
              anchorStatus={anchorStatus}
              timeline={timeline}
              credentialId={credentialId}
            />
          </TabsContent>

          <TabsContent value="chain">
            <ChainAnchorSection
              anchorStatus={anchorStatus}
              timeline={timeline}
              credentialId={credentialId}
              showFullChain
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Trust Explainer Sheet */}
      <TrustExplainerSheet
        open={showTrustExplainer}
        onOpenChange={setShowTrustExplainer}
        trustScore={trustScore}
        credential={credential}
      />
    </div>
  );
}

