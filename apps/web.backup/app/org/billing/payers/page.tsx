'use client';

/**
 * B137B-FE-004: Org Billing Panel - Payers & Enrollment Volume
 *
 * Displays enrollments this month, charges by plan, filter by payer.
 * Screen reader labels and accessible data visualization.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Building2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Calendar,
  FileText,
  Filter
} from 'lucide-react';
import { getPayerBillingMetrics, getPayers } from '@/lib/payer-client';
import type { PayerBillingMetrics, PayerInfo } from '@/lib/payer-types';
import { cn } from '@/lib/utils';

/**
 * Simple bar chart component
 */
function MonthlyTrendChart({ data }: { data: { month: string; enrollments: number }[] }) {
  if (data.length === 0) return null;

  const maxEnrollments = Math.max(...data.map(d => d.enrollments), 1);

  return (
    <div className="space-y-3" role="img" aria-label="Monthly enrollment trend chart">
      {data.map((item) => {
        const percentage = (item.enrollments / maxEnrollments) * 100;

        return (
          <div key={item.month}>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600 font-medium">{item.month}</span>
              <span className="font-semibold">{item.enrollments}</span>
            </div>
            <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 flex items-center justify-end px-3"
                style={{ width: `${percentage}%` }}
                role="progressbar"
                aria-valuenow={item.enrollments}
                aria-valuemin={0}
                aria-valuemax={maxEnrollments}
                aria-label={`${item.month}: ${item.enrollments} enrollments`}
              >
                {percentage > 15 && (
                  <span className="text-white text-xs font-semibold">
                    {item.enrollments}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function OrgBillingPayersPage() {
  const [metrics, setMetrics] = useState<PayerBillingMetrics[]>([]);
  const [payers, setPayers] = useState<PayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayerId, setSelectedPayerId] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [selectedPayerId]);

  async function fetchData() {
    setLoading(true);
    try {
      const [metricsData, payersData] = await Promise.all([
        getPayerBillingMetrics(
          selectedPayerId !== 'all' ? { payerId: selectedPayerId } : undefined
        ),
        getPayers()
      ]);

      setMetrics(metricsData || []);
      setPayers(payersData || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load billing metrics. Please try again.',
        variant: 'destructive'
      });
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate totals
  const totalEnrollments = metrics.reduce((sum, m) => sum + m.currentMonth.enrollments, 0);
  const totalNewEnrollments = metrics.reduce((sum, m) => sum + m.currentMonth.newEnrollments, 0);
  const totalRevalidations = metrics.reduce((sum, m) => sum + m.currentMonth.revalidations, 0);

  // Get current month name
  const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

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
              <Link href="/org/privileges" className="text-gray-600 hover:text-blue-600 transition-colors">
                Privileges
              </Link>
              <Link href="/org/billing/payers" className="text-blue-600 font-medium">
                Billing
              </Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Page Title & Filter */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
                  Payer Billing & Enrollment
                </h1>
                <p className="text-lg text-gray-600">
                  Track enrollment volume and billing metrics by payer
                </p>
              </div>

              {/* Payer Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-gray-500" aria-hidden="true" />
                <Select value={selectedPayerId} onValueChange={setSelectedPayerId}>
                  <SelectTrigger className="w-[200px]" aria-label="Filter by payer">
                    <SelectValue placeholder="All Payers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payers</SelectItem>
                    {payers.map((payer) => (
                      <SelectItem key={payer.id} value={payer.id}>
                        {payer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">
                        Total Enrollments
                      </div>
                      <div className="text-3xl font-bold text-gray-900">
                        {totalEnrollments}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {currentMonth}
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">
                        New This Month
                      </div>
                      <div className="text-3xl font-bold text-green-600">
                        {totalNewEnrollments}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        New enrollments
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-green-600" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">
                        Revalidations
                      </div>
                      <div className="text-3xl font-bold text-orange-600">
                        {totalRevalidations}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        In progress
                      </div>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-orange-600" aria-hidden="true" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Payer Metrics */}
          <div className="space-y-6">
            {loading ? (
              <>
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : metrics.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No billing data available
                  </h3>
                  <p className="text-gray-600">
                    Start enrolling with payers to see billing metrics here
                  </p>
                </CardContent>
              </Card>
            ) : (
              metrics.map((metric) => (
                <Card key={metric.payerId}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />
                        </div>
                        <div>
                          <CardTitle>{metric.payerName}</CardTitle>
                          <CardDescription>
                            Enrollment and billing activity
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Current Month Stats */}
                      <div>
                        <h4 className="font-semibold mb-4">Current Month ({currentMonth})</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm text-gray-600">Total Enrollments</span>
                            <Badge variant="secondary" className="text-base">
                              {metric.currentMonth.enrollments}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <span className="text-sm text-gray-600 flex items-center gap-1">
                              <TrendingUp className="h-4 w-4" />
                              New Enrollments
                            </span>
                            <Badge variant="secondary" className="text-base bg-green-100 text-green-800">
                              {metric.currentMonth.newEnrollments}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                            <span className="text-sm text-gray-600">Revalidations</span>
                            <Badge variant="secondary" className="text-base bg-orange-100 text-orange-800">
                              {metric.currentMonth.revalidations}
                            </Badge>
                          </div>
                        </div>

                        {/* Status Breakdown */}
                        {metric.statusBreakdown && metric.statusBreakdown.length > 0 && (
                          <div className="mt-6">
                            <h5 className="text-sm font-semibold mb-3">Status Breakdown</h5>
                            <div className="flex flex-wrap gap-2">
                              {metric.statusBreakdown.map((status) => (
                                <Badge key={status.status} variant="outline" className="capitalize">
                                  {status.status.replace('_', ' ')}: {status.count}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Monthly Trend */}
                      <div>
                        <h4 className="font-semibold mb-4">Last 6 Months Trend</h4>
                        <MonthlyTrendChart data={metric.monthlyTrend.slice(-6)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Export/Actions */}
          <div className="mt-8 flex justify-end">
            <Button variant="outline" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Export Report
            </Button>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

