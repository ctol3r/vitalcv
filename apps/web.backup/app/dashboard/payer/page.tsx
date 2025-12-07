'use client';

/**
 * B137B-FE-001: Clinician Dashboard - Payer Enrollment Overview
 *
 * Shows current enrollments with payer name, status, last update, next revalidation.
 * Includes screen reader friendly labels and accessible navigation.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Plus,
  Search,
  Building2,
  Clock,
  AlertCircle,
  CheckCircle,
  XCircle,
  Pause,
  RefreshCw,
  FileText,
  Calendar
} from 'lucide-react';
import { getEnrollments, getPayers } from '@/lib/payer-client';
import type { PayerEnrollment, PayerInfo, PayerEnrollmentStatus } from '@/lib/payer-types';
import { cn } from '@/lib/utils';

/**
 * Status configuration for visual display
 */
const statusConfig: Record<PayerEnrollmentStatus, {
  label: string;
  icon: typeof CheckCircle;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  description: string;
}> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    variant: 'outline',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
    description: 'Enrollment draft in progress'
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    description: 'Submitted, awaiting review'
  },
  in_review: {
    label: 'In Review',
    icon: RefreshCw,
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Under active review'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    variant: 'default',
    className: 'bg-green-100 text-green-800 border-green-300',
    description: 'Enrollment approved'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    variant: 'destructive',
    className: 'bg-red-100 text-red-800 border-red-300',
    description: 'Enrollment rejected'
  },
  suspended: {
    label: 'Suspended',
    icon: Pause,
    variant: 'outline',
    className: 'bg-orange-100 text-orange-800 border-orange-300',
    description: 'Temporarily suspended'
  },
  terminated: {
    label: 'Terminated',
    icon: XCircle,
    variant: 'outline',
    className: 'bg-gray-100 text-gray-700 border-gray-300',
    description: 'Enrollment terminated'
  },
  revalidating: {
    label: 'Revalidating',
    icon: RefreshCw,
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Undergoing revalidation'
  }
};

/**
 * Format date for display
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'N/A';

  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculate days until revalidation
 */
function getDaysUntilRevalidation(date: string | undefined): number | null {
  if (!date) return null;

  const revalidationDate = new Date(date);
  const today = new Date();
  const diffTime = revalidationDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Enrollment row component
 */
function EnrollmentRow({ enrollment }: { enrollment: PayerEnrollment }) {
  const config = statusConfig[enrollment.status];
  const StatusIcon = config.icon;
  const daysUntilRevalidation = getDaysUntilRevalidation(enrollment.nextRevalidation);

  return (
    <Link
      href={`/dashboard/payer/${enrollment.id}`}
      className="block hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
      aria-label={`View enrollment details for ${enrollment.payer.name}`}
    >
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start md:items-center">
          {/* Payer Name & Logo */}
          <div className="md:col-span-2 flex items-center gap-3">
            {enrollment.payer.logoUrl ? (
              <img
                src={enrollment.payer.logoUrl}
                alt={`${enrollment.payer.name} logo`}
                className="h-10 w-10 rounded-lg object-contain bg-white border border-gray-200"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate">
                {enrollment.payer.name}
              </h3>
              <p className="text-sm text-gray-600 capitalize">
                {enrollment.payer.type}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge
              variant={config.variant}
              className={cn('flex items-center gap-1.5', config.className)}
            >
              <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{config.label}</span>
            </Badge>
          </div>

          {/* Last Update */}
          <div className="text-sm">
            <div className="font-medium text-gray-900">
              {formatDate(enrollment.lastUpdated)}
            </div>
            <div className="text-gray-600">
              Last updated
            </div>
          </div>

          {/* Next Revalidation */}
          <div className="text-sm">
            {enrollment.nextRevalidation ? (
              <div>
                <div className="font-medium text-gray-900 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                  {formatDate(enrollment.nextRevalidation)}
                </div>
                <div className={cn(
                  'text-gray-600',
                  daysUntilRevalidation !== null && daysUntilRevalidation < 90 && 'text-orange-600 font-medium',
                  daysUntilRevalidation !== null && daysUntilRevalidation < 30 && 'text-red-600 font-medium'
                )}>
                  {daysUntilRevalidation !== null && daysUntilRevalidation > 0 ? (
                    `${daysUntilRevalidation} days`
                  ) : daysUntilRevalidation !== null && daysUntilRevalidation <= 0 ? (
                    'Overdue'
                  ) : (
                    'Due soon'
                  )}
                </div>
              </div>
            ) : (
              <div className="text-gray-500">
                N/A
              </div>
            )}
          </div>
        </div>

        {/* Product Lines */}
        {enrollment.productLines.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {enrollment.productLines.map((line) => (
              <Badge
                key={line}
                variant="outline"
                className="text-xs capitalize"
              >
                {line.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function PayerEnrollmentOverviewPage() {
  const [enrollments, setEnrollments] = useState<PayerEnrollment[]>([]);
  const [payers, setPayers] = useState<PayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [enrollmentsData, payersData] = await Promise.all([
        getEnrollments(),
        getPayers()
      ]);

      setEnrollments(enrollmentsData.enrollments || []);
      setPayers(payersData || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load enrollment data. Please try again.',
        variant: 'destructive'
      });
      console.error('Failed to fetch enrollments:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter enrollments based on search
  const filteredEnrollments = enrollments.filter((enrollment) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      enrollment.payer.name.toLowerCase().includes(query) ||
      enrollment.status.toLowerCase().includes(query) ||
      enrollment.productLines.some(line => line.toLowerCase().includes(query))
    );
  });

  // Group enrollments by status for summary
  const statusSummary = enrollments.reduce((acc, enrollment) => {
    acc[enrollment.status] = (acc[enrollment.status] || 0) + 1;
    return acc;
  }, {} as Record<PayerEnrollmentStatus, number>);

  // Count upcoming revalidations (within 90 days)
  const upcomingRevalidations = enrollments.filter((enrollment) => {
    const days = getDaysUntilRevalidation(enrollment.nextRevalidation);
    return days !== null && days > 0 && days <= 90;
  }).length;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
            <nav className="hidden md:flex items-center space-x-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-blue-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard/payer" className="text-blue-600 font-medium">
                Payer Enrollment
              </Link>
              <Link href="/wallet" className="text-gray-600 hover:text-blue-600 transition-colors">
                Credentials
              </Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {/* Page Title & Actions */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  Payer Enrollment
                </h1>
                <p className="text-lg text-gray-600">
                  Manage your insurance payer enrollments and credentialing
                </p>
              </div>

              <Link href="/dashboard/payer/start">
                <Button size="lg" className="flex items-center gap-2">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  <span>New Enrollment</span>
                </Button>
              </Link>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900">
                      {enrollments.length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Total Enrollments
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {statusSummary.approved || 0}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Approved
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {(statusSummary.pending || 0) + (statusSummary.in_review || 0)}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Pending Review
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">
                      {upcomingRevalidations}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Revalidations Due
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search enrollments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search enrollments by payer name, status, or product line"
              />
            </div>
          </div>

          {/* Enrollments List */}
          <Card>
            <CardHeader>
              <CardTitle>Your Enrollments</CardTitle>
              <CardDescription>
                View and manage your payer enrollment status
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="divide-y">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-6">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-5 w-48" />
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredEnrollments.length === 0 ? (
                <div className="p-12 text-center">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {searchQuery ? 'No enrollments found' : 'No enrollments yet'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {searchQuery
                      ? 'Try adjusting your search criteria'
                      : 'Get started by creating your first payer enrollment'}
                  </p>
                  {!searchQuery && (
                    <Link href="/dashboard/payer/start">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
                        Create Enrollment
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="divide-y" role="list" aria-label="Payer enrollments">
                  {filteredEnrollments.map((enrollment) => (
                    <div key={enrollment.id} role="listitem">
                      <EnrollmentRow enrollment={enrollment} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </AuthGuard>
  );
}

