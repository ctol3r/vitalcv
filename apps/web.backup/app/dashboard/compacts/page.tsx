'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CompactEligibilityBadge, CompactType } from '@/components/CompactEligibilityBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, XCircle, MapPin, Info, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface CompactStatus {
  compact: CompactType;
  status: 'ACTIVE' | 'ELIGIBLE' | 'PENDING' | 'NOT_ELIGIBLE';
  eligibleStates: string[];
  homeState?: string;
  dateEnrolled?: string;
  expirationDate?: string;
  notes?: string;
}

interface ClinicianCompactData {
  npi: string;
  name: string;
  compacts: CompactStatus[];
  allLicensedStates: string[];
}

/**
 * Clinician Dashboard: Cross-State & Compact Status Card
 *
 * Displays IMLC, PSYPACT, and Counseling Compact status
 * Shows covered states and eligibility information
 * Screen reader friendly with ARIA labels and semantic HTML
 *
 * Acceptance Criteria:
 * - Shows IMLC, PSYPACT, Counseling status
 * - Lists covered states
 * - SR-friendly (ARIA labels, semantic structure, keyboard navigation)
 */
export default function CompactsPage() {
  const [data, setData] = useState<ClinicianCompactData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCompactStatus() {
      try {
        // In a real app, this would fetch from backend
        // For now, we'll use mock data
        const response = await fetch('/api/clinician/compacts');

        if (!response.ok) {
          // Mock data fallback
          const mockData: ClinicianCompactData = {
            npi: '1234567890',
            name: 'Dr. Jane Smith',
            compacts: [
              {
                compact: 'IMLC',
                status: 'ACTIVE',
                eligibleStates: ['AL', 'AZ', 'CO', 'GA', 'ID', 'IL', 'IA', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'PA', 'SD', 'TN', 'UT', 'WA', 'WV', 'WI', 'WY'],
                homeState: 'CO',
                dateEnrolled: '2024-03-15',
                expirationDate: '2025-03-15',
              },
              {
                compact: 'PSYPACT',
                status: 'ELIGIBLE',
                eligibleStates: ['AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'GA', 'ID', 'IL', 'IN', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC', 'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'],
                homeState: 'CO',
              },
              {
                compact: 'COUNSELING',
                status: 'NOT_ELIGIBLE',
                eligibleStates: [],
                notes: 'Requires professional counseling license',
              },
            ],
            allLicensedStates: ['CO', 'CA', 'NY'],
          };
          setData(mockData);
        } else {
          const data = await response.json();
          setData(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load compact status');
        // Still show mock data on error for demo
        const mockData: ClinicianCompactData = {
          npi: '1234567890',
          name: 'Dr. Jane Smith',
          compacts: [
            {
              compact: 'IMLC',
              status: 'ACTIVE',
              eligibleStates: ['AL', 'AZ', 'CO', 'GA', 'ID', 'IL', 'IA', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MS', 'MT', 'NE', 'NH', 'PA', 'SD', 'TN', 'UT', 'WA', 'WV', 'WI', 'WY'],
              homeState: 'CO',
              dateEnrolled: '2024-03-15',
              expirationDate: '2025-03-15',
            },
            {
              compact: 'PSYPACT',
              status: 'ELIGIBLE',
              eligibleStates: ['AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'GA', 'ID', 'IL', 'IN', 'KS', 'KY', 'ME', 'MD', 'MI', 'MN', 'MO', 'NE', 'NV', 'NH', 'NJ', 'NC', 'OH', 'OK', 'PA', 'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WI'],
              homeState: 'CO',
            },
            {
              compact: 'COUNSELING',
              status: 'NOT_ELIGIBLE',
              eligibleStates: [],
              notes: 'Requires professional counseling license',
            },
          ],
          allLicensedStates: ['CO', 'CA', 'NY'],
        };
        setData(mockData);
      } finally {
        setLoading(false);
      }
    }

    fetchCompactStatus();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">{error || 'Failed to load compact data'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusIcon = (status: CompactStatus['status']) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />;
      case 'ELIGIBLE':
        return <CheckCircle2 className="h-5 w-5 text-blue-600" aria-hidden="true" />;
      case 'PENDING':
        return <Info className="h-5 w-5 text-yellow-600" aria-hidden="true" />;
      case 'NOT_ELIGIBLE':
        return <XCircle className="h-5 w-5 text-gray-400" aria-hidden="true" />;
    }
  };

  const getStatusBadge = (status: CompactStatus['status']) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Active
          </Badge>
        );
      case 'ELIGIBLE':
        return (
          <Badge variant="outline" className="border-blue-600 text-blue-600">
            Eligible
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge variant="outline" className="border-yellow-600 text-yellow-600">
            Pending
          </Badge>
        );
      case 'NOT_ELIGIBLE':
        return (
          <Badge variant="outline" className="border-gray-400 text-gray-500">
            Not Eligible
          </Badge>
        );
    }
  };

  const getCompactInfo = (compactType: CompactType) => {
    const info = {
      IMLC: {
        fullName: 'Interstate Medical Licensure Compact',
        description: 'Allows physicians to practice medicine across 40+ compact member states',
        officialUrl: 'https://www.imlcc.org/',
      },
      PSYPACT: {
        fullName: 'Psychology Interjurisdictional Compact',
        description: 'Enables licensed psychologists to practice telepsychology and provide temporary in-person services',
        officialUrl: 'https://www.psypact.org/',
      },
      COUNSELING: {
        fullName: 'Counseling Compact',
        description: 'Allows licensed professional counselors to practice across compact member states',
        officialUrl: 'https://www.counseling-compact.org/',
      },
    };
    return info[compactType];
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Cross-State & Compact Status</h1>
        <p className="text-lg text-gray-600">
          Manage your interstate compact memberships and cross-state practice eligibility
        </p>
      </div>

      {/* Overview Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" aria-hidden="true" />
            Your Compact Overview
          </CardTitle>
          <CardDescription>
            Active and eligible compact memberships for {data.name} (NPI: {data.npi})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" role="list" aria-label="Compact memberships">
            {data.compacts.map((compact) => (
              <div key={compact.compact} role="listitem">
                <CompactEligibilityBadge
                  compactType={compact.compact}
                  eligibleStates={compact.eligibleStates}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">
              <strong>Your Licensed States:</strong>{' '}
              <span className="inline-flex flex-wrap gap-1 ml-1">
                {data.allLicensedStates.map((state) => (
                  <Badge key={state} variant="secondary" className="text-xs">
                    {state}
                  </Badge>
                ))}
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Individual Compact Cards */}
      <div className="space-y-6" role="list" aria-label="Detailed compact information">
        {data.compacts.map((compact) => {
          const info = getCompactInfo(compact.compact);
          return (
            <Card
              key={compact.compact}
              role="listitem"
              aria-labelledby={`compact-${compact.compact}-title`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle
                      id={`compact-${compact.compact}-title`}
                      className="flex items-center gap-2"
                    >
                      {getStatusIcon(compact.status)}
                      <span>{info.fullName}</span>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {info.description}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(compact.status)}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                            aria-label={`Visit ${info.fullName} official website`}
                          >
                            <a
                              href={info.officialUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Visit official website</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {compact.status === 'ACTIVE' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {compact.homeState && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Home State</p>
                          <Badge variant="secondary">{compact.homeState}</Badge>
                        </div>
                      )}
                      {compact.dateEnrolled && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Enrolled</p>
                          <p className="text-sm">
                            {new Date(compact.dateEnrolled).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                      {compact.expirationDate && (
                        <div>
                          <p className="text-sm font-medium text-gray-600 mb-1">Expires</p>
                          <p className="text-sm">
                            {new Date(compact.expirationDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        Eligible States ({compact.eligibleStates.length})
                      </p>
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="list"
                        aria-label={`States covered by ${compact.compact}`}
                      >
                        {compact.eligibleStates.map((state) => (
                          <Badge
                            key={state}
                            variant="outline"
                            className="text-xs"
                            role="listitem"
                          >
                            {state}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {compact.status === 'ELIGIBLE' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        You are eligible to apply for {compact.compact}. Enrollment will give you
                        privileges to practice in {compact.eligibleStates.length} states.
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        Potential Coverage ({compact.eligibleStates.length} states)
                      </p>
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="list"
                        aria-label={`Potential states with ${compact.compact}`}
                      >
                        {compact.eligibleStates.map((state) => (
                          <Badge
                            key={state}
                            variant="outline"
                            className="text-xs opacity-70"
                            role="listitem"
                          >
                            {state}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className="pt-4 border-t">
                      <Link href={`/dashboard/compacts/wizard?compact=${compact.compact}`}>
                        <Button>Check Eligibility & Apply</Button>
                      </Link>
                    </div>
                  </div>
                )}

                {compact.status === 'NOT_ELIGIBLE' && (
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {compact.notes || `You are not currently eligible for ${compact.compact}.`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Card className="mt-6 bg-gray-50 dark:bg-gray-900">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" aria-hidden="true" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Link href="/dashboard/compacts/wizard" className="text-blue-600 hover:underline">
              Check your compact eligibility →
            </Link>
          </div>
          <div>
            <Link href="/docs/regulatory/cross-licensure" className="text-blue-600 hover:underline">
              Learn about interstate compacts →
            </Link>
          </div>
          <div>
            <Link href="/support" className="text-blue-600 hover:underline">
              Contact support →
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

