'use client';

/**
 * Hospital Credentialing Dashboard
 * Chain-backed, compliance-ready credential management
 * One place to manage truth
 */

import { useState, useEffect } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useVerifierDashboard } from '@/hooks/use-verifier-dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle } from 'lucide-react';
import { DashboardOverview } from '@/components/verifier-dashboard/DashboardOverview';
import { VerifierProviderListView } from '@/components/verifier-dashboard/VerifierProviderListView';
import { VerificationQueueView } from '@/components/verifier-dashboard/VerificationQueueView';
import { ComplianceAlertsView } from '@/components/verifier-dashboard/ComplianceAlertsView';
import { ChainAuditHubView } from '@/components/verifier-dashboard/ChainAuditHubView';
import type { DashboardTab } from '@/lib/verifier-dashboard-types';

export default function VerifierDashboardPage() {
  const { canAccessVerifier } = useSession();
  const { state, error, refresh } = useVerifierDashboard();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // Handle deep link: vitalcv://verifier/dashboard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for deep link in URL params
      const params = new URLSearchParams(window.location.search);
      const deepLink = params.get('deeplink');
      if (deepLink === 'vitalcv://verifier/dashboard') {
        // Already on dashboard, just ensure we're showing the right tab
        const tab = params.get('tab') as DashboardTab;
        if (tab && ['overview', 'providers', 'queue', 'compliance', 'audit'].includes(tab)) {
          setActiveTab(tab);
        }
      }

      // Listen for custom deep link events
      const handleDeepLink = (e: CustomEvent) => {
        const url = e.detail.url;
        if (url.startsWith('vitalcv://verifier/dashboard')) {
          const tabMatch = url.match(/tab=(\w+)/);
          if (tabMatch) {
            setActiveTab(tabMatch[1] as DashboardTab);
          }
        }
      };

      window.addEventListener('vitalcv-deeplink', handleDeepLink as EventListener);
      return () => {
        window.removeEventListener('vitalcv-deeplink', handleDeepLink as EventListener);
      };
    }
  }, []);

  // Role-locked access (VerifierOnly)
  if (!canAccessVerifier()) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <Card className="border-amber-300 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="h-5 w-5" />
              Access Restricted
            </CardTitle>
            <CardDescription className="text-amber-800">
              This dashboard is only available to users with the Verifier role.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <div className="space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (state === 'error' && error) {
    return (
      <div className="container mx-auto max-w-6xl py-8 px-4">
        <Card className="border-red-300 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Error Loading Dashboard
            </CardTitle>
            <CardDescription className="text-red-800">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              onClick={() => refresh()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Hospital Credentialing Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Chain-backed credential management and compliance monitoring
        </p>
      </header>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DashboardTab)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="providers">Provider List</TabsTrigger>
          <TabsTrigger value="queue">Verification Queue</TabsTrigger>
          <TabsTrigger value="compliance">Compliance Alerts</TabsTrigger>
          <TabsTrigger value="audit">Chain Audit Hub</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <DashboardOverview />
        </TabsContent>

        <TabsContent value="providers" className="mt-6">
          <VerifierProviderListView />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <VerificationQueueView />
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <ComplianceAlertsView />
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <ChainAuditHubView />
        </TabsContent>
      </Tabs>
    </div>
  );
}

