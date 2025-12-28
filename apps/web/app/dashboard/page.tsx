'use client';

import { DashboardAnalytics } from '@/components/DashboardAnalytics';
import { AuthGuard } from '@/components/auth-guard';
import { AnalyticsCard } from '@/components/dashboard/AnalyticsCard';
import { LicensureCard } from '@/components/dashboard/LicensureCard';
import { NPICard } from '@/components/dashboard/NPICard';
import { NotificationsCard } from '@/components/dashboard/NotificationsCard';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';
import { PaneProvider, usePanes } from '@/components/panes/PaneManager';
import { PulseFeed } from '@/pulse/PulseFeed';
import { usePulse } from '@/pulse/usePulse';
import type { PulseEvent } from '@/pulse/types';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Shield } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface ClinicianData {
  npi: string;
  name: string;
  credentials: string;
  primaryTaxonomy: string;
  practiceAddress: {
    address1: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
  };
  enumerationDate: string;
  lastUpdated: string;
  status: string;
  lastSynced?: string;
}

interface LicenseData {
  state: string;
  number: string;
  status: 'active' | 'expired' | 'expiring_soon';
  expiration: string;
  verified: boolean;
}

interface NotificationData {
  id: number;
  type: 'info' | 'warning' | 'update';
  message: string;
  timestamp: string;
  actionRequired: boolean;
}

export default function DashboardPage() {
  const [clinicianData, setClinicianData] = useState<ClinicianData | null>(null);
  const [licenses, setLicenses] = useState<LicenseData[]>([]);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { events: pulseEvents } = usePulse();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Mock data since we don't have a dashboard API endpoint yet
      const mockClinicianData: ClinicianData = {
        npi: '1234567890',
        name: 'Dr. Sarah Johnson',
        credentials: 'MD',
        primaryTaxonomy: '207R00000X - Internal Medicine',
        practiceAddress: {
          address1: '123 Medical Center Dr',
          city: 'Healthcare City',
          state: 'CA',
          postalCode: '12345',
          countryCode: 'US',
        },
        enumerationDate: '2015-07-15',
        lastUpdated: '2024-01-15',
        status: 'Active',
        lastSynced: '2024-01-15T10:30:00Z',
      };

      const mockLicenses: LicenseData[] = [
        {
          state: 'California',
          number: 'A12345',
          status: 'active',
          expiration: '2025-12-31',
          verified: true,
        },
        {
          state: 'Nevada',
          number: 'NV98765',
          status: 'expiring_soon',
          expiration: '2024-03-15',
          verified: true,
        },
        {
          state: 'Arizona',
          number: 'AZ54321',
          status: 'expired',
          expiration: '2023-11-30',
          verified: false,
        },
      ];

      const mockNotifications: NotificationData[] = [
        {
          id: 1,
          type: 'warning',
          message: 'Nevada medical license expires in 45 days',
          timestamp: '2 hours ago',
          actionRequired: true,
        },
        {
          id: 2,
          type: 'update',
          message: 'Updated information detected in NPPES registry',
          timestamp: '1 day ago',
          actionRequired: true,
        },
        {
          id: 3,
          type: 'info',
          message: 'Profile verification completed successfully',
          timestamp: '3 days ago',
          actionRequired: false,
        },
      ];

      setClinicianData(mockClinicianData);
      setLicenses(mockLicenses);
      setNotifications(mockNotifications);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNpiSync = async () => {
    if (!clinicianData) return;

    try {
      const response = await fetch('/api/clinician/npi-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          npi: clinicianData.npi,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to sync NPI data');
      }

      const data = await response.json();
      setClinicianData({
        ...data.npiData,
        lastSynced: data.lastSynced,
      });

      toast({
        title: 'Sync Complete',
        description: 'NPI data has been updated successfully',
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unable to sync NPI data. Please try again.';
      toast({
        title: 'Sync Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  const handleDownloadPDF = async () => {
    try {
      // Mock PDF generation
      toast({
        title: 'PDF Generated',
        description: 'Your profile PDF has been downloaded',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to generate PDF',
        variant: 'destructive',
      });
    }
  };

  const handleShareProfile = async () => {
    try {
      const shareUrl = `${window.location.origin}/profile/${clinicianData?.npi}`;
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link Copied',
        description: 'Profile link copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy profile link',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <PaneProvider>
          <DashboardSkeleton />
        </PaneProvider>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <PaneProvider>
        <DashboardContent
          clinicianData={clinicianData}
          licenses={licenses}
          notifications={notifications}
          onNpiSync={handleNpiSync}
          onDownloadPDF={handleDownloadPDF}
          onShareProfile={handleShareProfile}
          onReviewNotification={(id) =>
            toast({
              title: 'Notification Reviewed',
              description: `Notification ${id} has been marked as reviewed`,
            })
          }
          pulseEvents={pulseEvents}
        />
      </PaneProvider>
    </AuthGuard>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-96" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardContent({
  clinicianData,
  licenses,
  notifications,
  onNpiSync,
  onDownloadPDF,
  onShareProfile,
  onReviewNotification,
  pulseEvents,
}: {
  clinicianData: ClinicianData | null;
  licenses: LicenseData[];
  notifications: NotificationData[];
  onNpiSync: () => Promise<void>;
  onDownloadPDF: () => Promise<void>;
  onShareProfile: () => Promise<void>;
  onReviewNotification: (id: number) => void;
  pulseEvents: PulseEvent[];
}) {
  const { push } = usePanes();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash === '#pulse') {
      document.getElementById('pulse-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const handleInspect = (event: PulseEvent) =>
    push({
      title: `Inspect • ${event.title}`,
      content: (
        <div className="space-y-4 p-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {event.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-foreground">{event.summary}</p>
            {event.tags && (
              <div className="flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-[11px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Separator />
          <div className="space-y-2 text-sm text-muted-foreground">
            <div>
              Source: <span className="font-medium text-foreground">{event.source}</span>
            </div>
            {event.relatedEntity?.label && (
              <div>
                Related: <span className="font-medium text-foreground">{event.relatedEntity.label}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {event.links
              .filter((link) => link.destination !== 'inspect')
              .map((link) => (
                <Button key={link.label} asChild variant="outline" size="sm">
                  <Link href={link.href}>
                    {link.label}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ))}
            <Button asChild size="sm" variant="default">
              <Link href="/graph">Open Graph</Link>
            </Button>
          </div>
        </div>
      ),
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link href="/verify" className="text-gray-600 hover:text-blue-600 transition-colors">
              Verify
            </Link>
            <Link href="/analytics" className="text-gray-600 hover:text-blue-600 transition-colors">
              Analytics
            </Link>
            <Link href="/support" className="text-gray-600 hover:text-blue-600 transition-colors">
              Support
            </Link>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 lg:py-12 space-y-8">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Clinician Dashboard</h1>
          <p className="text-lg text-gray-600">
            Manage your professional credentials and verification status
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
          {/* Main Content - Takes up 3 columns on xl screens */}
          <div className="xl:col-span-3 space-y-6">
            {/* NPI Card */}
            {clinicianData && (
              <NPICard
                npi={clinicianData.npi}
                name={clinicianData.name}
                credentials={clinicianData.credentials}
                status={clinicianData.status}
                lastSynced={clinicianData.lastSynced}
                verified={true}
                onSync={onNpiSync}
              />
            )}

            <div id="pulse-feed" className="scroll-mt-24">
              <PulseFeed events={pulseEvents} onInspect={handleInspect} />
            </div>

            {/* Licensure Card */}
            <LicensureCard licenses={licenses} />

            {/* Analytics */}
            <AnalyticsCard />

            {/* Full Analytics */}
            <DashboardAnalytics />
          </div>

          {/* Sidebar - Takes up 1 column on xl screens */}
          <div className="space-y-6">
            {/* Notifications */}
            <NotificationsCard notifications={notifications} onReview={onReviewNotification} />

            {/* Quick Actions */}
            {clinicianData && (
              <QuickActionsCard
                npi={clinicianData.npi}
                onDownloadPDF={onDownloadPDF}
                onShareProfile={onShareProfile}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
