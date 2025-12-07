/**
 * Regulatory Portal - Main Page
 * Phase 1: Regulatory Portal Foundation
 *
 * SwiftUI-native • Compliance-grade • Government-aligned • Chain-attested
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Shield, AlertCircle, RefreshCw, Anchor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useRegulatoryPortal } from '@/lib/regulatory/view-model';
import { initDeepLinkListener } from '@/lib/regulatory/deep-links';
import { StateBoardView } from './components/StateBoardView';
import { DEAComplianceView } from './components/DEAComplianceView';
import { CMSPECOSView } from './components/CMSPECOSView';
import { PayerEnrollmentView } from './components/PayerEnrollmentView';

export default function RegulatoryPortalPage() {
  const [clinicianId, setClinicianId] = useState<string | null>(null);
  const [defaultTab, setDefaultTab] = useState<string>('state-boards');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Get clinicianId from localStorage or API
    const storedId = localStorage.getItem('clinicianId');
    if (storedId) {
      setClinicianId(storedId);
    } else {
      fetch('/api/profile/me')
        .then((res) => res.json())
        .then((data) => {
          if (data?.id || data?.clinicianId) {
            setClinicianId(data.id || data.clinicianId);
          }
        })
        .catch(() => {
          // Fallback: use demo ID
          setClinicianId('demo-clinician-001');
        });
    }
  }, []);

  // Task 8 & 32: Deep link handling
  useEffect(() => {
    const tab = searchParams?.get('tab');
    if (tab && ['state-boards', 'dea', 'cms', 'payers'].includes(tab)) {
      setDefaultTab(tab);
    }

    // Initialize deep link listener
    const cleanup = initDeepLinkListener((path) => {
      router.push(path);
    });

    return cleanup;
  }, [searchParams, router]);

  const {
    ready: bundle,
    loading,
    error,
    activeLicenses,
    expiringLicenses,
    deaExpiringSoon,
    trustScore,
    refresh,
  } = useRegulatoryPortal(clinicianId);

  if (loading && !bundle) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error && !bundle) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Error Loading Regulatory Portal
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refresh}>Retry</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Regulatory Portal
          </h1>
          <p className="text-muted-foreground mt-2">
            Compliance-grade • Government-aligned • Chain-attested
          </p>
        </div>
        <div className="flex items-center gap-4">
          {bundle && (
            <div className="flex items-center gap-2">
              <Anchor className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Trust Score: <span className="font-semibold">{Math.round(trustScore * 100)}%</span>
              </span>
            </div>
          )}
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {bundle && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Licenses</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeLicenses.length}</div>
              {expiringLicenses.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {expiringLicenses.length} expiring soon
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">DEA Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bundle.dea ? (
                  <Badge variant={bundle.dea.status === 'active' ? 'default' : 'destructive'}>
                    {bundle.dea.status.toUpperCase()}
                  </Badge>
                ) : (
                  'N/A'
                )}
              </div>
              {deaExpiringSoon && (
                <p className="text-xs text-destructive mt-1">Expires in 30 days</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">CMS/PECOS</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bundle.cms ? (
                  <Badge
                    variant={
                      bundle.cms.pecosEnrollmentStatus === 'enrolled' ? 'default' : 'secondary'
                    }
                  >
                    {bundle.cms.pecosEnrollmentStatus.toUpperCase()}
                  </Badge>
                ) : (
                  'N/A'
                )}
              </div>
              {bundle.cms?.revalidationDue && (
                <p className="text-xs text-destructive mt-1">Revalidation due</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payer Enrollments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bundle.payers.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {bundle.payers.filter((p) => p.enrollmentStatus === 'active').length} active
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="state-boards">State Boards</TabsTrigger>
          <TabsTrigger value="dea">DEA/MATE</TabsTrigger>
          <TabsTrigger value="cms">CMS/PECOS</TabsTrigger>
          <TabsTrigger value="payers">Payers</TabsTrigger>
        </TabsList>

        <TabsContent value="state-boards" className="space-y-4">
          <StateBoardView clinicianId={clinicianId} bundle={bundle} />
        </TabsContent>

        <TabsContent value="dea" className="space-y-4">
          <DEAComplianceView clinicianId={clinicianId} bundle={bundle} />
        </TabsContent>

        <TabsContent value="cms" className="space-y-4">
          <CMSPECOSView clinicianId={clinicianId} bundle={bundle} />
        </TabsContent>

        <TabsContent value="payers" className="space-y-4">
          <PayerEnrollmentView clinicianId={clinicianId} bundle={bundle} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

