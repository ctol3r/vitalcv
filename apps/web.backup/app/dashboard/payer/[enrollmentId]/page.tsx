'use client';

/**
 * B137B-FE-003: Enrollment Detail View
 *
 * Shows payer, product lines, status timeline, evidence list, and export evidence ZIP.
 * Comprehensive view of a single enrollment with all related information.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  ArrowLeft,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Download,
  Calendar,
  RefreshCw,
  Pause,
  AlertCircle,
  ExternalLink,
  Package
} from 'lucide-react';
import { getEnrollment, downloadEvidenceZip } from '@/lib/payer-client';
import type { PayerEnrollment, EnrollmentEvent, EnrollmentEvidence, PayerEnrollmentStatus } from '@/lib/payer-types';
import { cn } from '@/lib/utils';

/**
 * Status configuration
 */
const statusConfig: Record<PayerEnrollmentStatus, {
  label: string;
  icon: typeof CheckCircle;
  className: string;
}> = {
  draft: {
    label: 'Draft',
    icon: FileText,
    className: 'bg-gray-100 text-gray-700'
  },
  pending: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-100 text-yellow-800'
  },
  in_review: {
    label: 'In Review',
    icon: RefreshCw,
    className: 'bg-blue-100 text-blue-800'
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800'
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-100 text-red-800'
  },
  suspended: {
    label: 'Suspended',
    icon: Pause,
    className: 'bg-orange-100 text-orange-800'
  },
  terminated: {
    label: 'Terminated',
    icon: XCircle,
    className: 'bg-gray-100 text-gray-700'
  },
  revalidating: {
    label: 'Revalidating',
    icon: RefreshCw,
    className: 'bg-purple-100 text-purple-800'
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
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format date and time
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format file size
 */
function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return 'Unknown size';

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EnrollmentDetailPage() {
  const params = useParams();
  const enrollmentId = params.enrollmentId as string;

  const [enrollment, setEnrollment] = useState<PayerEnrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchEnrollment() {
      setLoading(true);
      try {
        const data = await getEnrollment(enrollmentId);
        setEnrollment(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load enrollment details. Please try again.',
          variant: 'destructive'
        });
        console.error('Failed to fetch enrollment:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchEnrollment();
  }, [enrollmentId, toast]);

  const handleDownloadZip = async () => {
    if (!enrollment) return;

    setDownloadingZip(true);
    try {
      const blob = await downloadEvidenceZip(enrollment.id);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${enrollment.payer.name}_enrollment_evidence_${enrollment.id}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Download Started',
        description: 'Your evidence package is being downloaded.'
      });
    } catch (error) {
      toast({
        title: 'Download Failed',
        description: 'Failed to download evidence package. Please try again.',
        variant: 'destructive'
      });
      console.error('Failed to download ZIP:', error);
    } finally {
      setDownloadingZip(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
          <header className="border-b bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">VitalCV</span>
              </Link>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="space-y-6">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-96 w-full" />
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!enrollment) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
          <header className="border-b bg-white/80 backdrop-blur-sm">
            <div className="container mx-auto px-4 py-4">
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-2xl font-bold text-gray-900">VitalCV</span>
              </Link>
            </div>
          </header>

          <main className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="text-center py-12">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Enrollment Not Found
              </h2>
              <p className="text-gray-600 mb-6">
                The enrollment you're looking for doesn't exist or you don't have access to it.
              </p>
              <Link href="/dashboard/payer">
                <Button>Back to Enrollments</Button>
              </Link>
            </div>
          </main>
        </div>
      </AuthGuard>
    );
  }

  const config = statusConfig[enrollment.status];
  const StatusIcon = config.icon;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        {/* Header */}
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Back Button */}
          <Link href="/dashboard/payer">
            <Button variant="ghost" className="mb-6 flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Enrollments
            </Button>
          </Link>

          {/* Enrollment Summary Header */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                {/* Payer Info */}
                <div className="flex items-start gap-4 flex-1">
                  {enrollment.payer.logoUrl ? (
                    <img
                      src={enrollment.payer.logoUrl}
                      alt={`${enrollment.payer.name} logo`}
                      className="h-16 w-16 rounded-lg object-contain bg-white border border-gray-200"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="h-8 w-8 text-blue-600" aria-hidden="true" />
                    </div>
                  )}

                  <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">
                      {enrollment.payer.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <Badge
                        variant="secondary"
                        className={cn('flex items-center gap-1.5', config.className)}
                      >
                        <StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {config.label}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {enrollment.payer.type}
                      </Badge>
                    </div>

                    {/* Product Lines */}
                    <div className="flex flex-wrap gap-2">
                      {enrollment.productLines.map((line) => (
                        <Badge key={line} variant="outline" className="text-xs capitalize">
                          {line.replace('_', ' ')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleDownloadZip}
                    disabled={downloadingZip || enrollment.evidence.length === 0}
                    className="flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {downloadingZip ? 'Downloading...' : 'Download Evidence ZIP'}
                  </Button>

                  {enrollment.payer.website && (
                    <Button variant="outline" asChild>
                      <a
                        href={enrollment.payer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Payer Website
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Key Dates */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div>
                  <div className="text-sm text-gray-600 mb-1">Created</div>
                  <div className="font-medium">{formatDate(enrollment.createdAt)}</div>
                </div>

                {enrollment.submittedAt && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Submitted</div>
                    <div className="font-medium">{formatDate(enrollment.submittedAt)}</div>
                  </div>
                )}

                {enrollment.approvedAt && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Approved</div>
                    <div className="font-medium">{formatDate(enrollment.approvedAt)}</div>
                  </div>
                )}

                {enrollment.nextRevalidation && (
                  <div>
                    <div className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Next Revalidation
                    </div>
                    <div className="font-medium">{formatDate(enrollment.nextRevalidation)}</div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="summary" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="evidence">
                Evidence ({enrollment.evidence.length})
              </TabsTrigger>
              <TabsTrigger value="timeline">
                Timeline ({enrollment.events.length})
              </TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Enrollment Details</CardTitle>
                  <CardDescription>
                    Complete information about this enrollment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Enrollment ID</div>
                      <div className="font-mono text-sm">{enrollment.id}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-600 mb-1">Clinician NPI</div>
                      <div className="font-mono text-sm">{enrollment.clinicianNpi}</div>
                    </div>

                    {enrollment.clinicianName && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Clinician Name</div>
                        <div className="font-medium">{enrollment.clinicianName}</div>
                      </div>
                    )}

                    {enrollment.caqhProviderId && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1">CAQH Provider ID</div>
                        <div className="font-mono text-sm">{enrollment.caqhProviderId}</div>
                      </div>
                    )}

                    {enrollment.effectiveDate && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Effective Date</div>
                        <div className="font-medium">{formatDate(enrollment.effectiveDate)}</div>
                      </div>
                    )}

                    {enrollment.revalidationFrequency && (
                      <div>
                        <div className="text-sm text-gray-600 mb-1">Revalidation Frequency</div>
                        <div className="font-medium">Every {enrollment.revalidationFrequency} months</div>
                      </div>
                    )}
                  </div>

                  {enrollment.notes && (
                    <div className="pt-4 border-t">
                      <div className="text-sm text-gray-600 mb-2">Notes</div>
                      <div className="text-sm whitespace-pre-wrap">{enrollment.notes}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* VitalCV Credentials */}
              {enrollment.vitalcvCredentialIds && enrollment.vitalcvCredentialIds.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      VitalCV Credentials Used
                    </CardTitle>
                    <CardDescription>
                      Verified credentials from VitalCV that support this enrollment
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {enrollment.vitalcvCredentialIds.map((credId, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                          <Shield className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          <span className="font-mono text-sm">{credId}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Evidence Tab */}
            <TabsContent value="evidence">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence Documents</CardTitle>
                  <CardDescription>
                    All documents uploaded for this enrollment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enrollment.evidence.length === 0 ? (
                    <div className="text-center py-12">
                      <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No evidence documents uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {enrollment.evidence.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{doc.filename}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs capitalize">
                                  {doc.type.replace('_', ' ')}
                                </Badge>
                                <span>{formatFileSize(doc.size)}</span>
                                {doc.verified && (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Verified
                                  </span>
                                )}
                              </div>
                              {doc.expiresAt && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Expires: {formatDate(doc.expiresAt)}
                                </div>
                              )}
                            </div>
                          </div>

                          {doc.url && (
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                            >
                              <a href={doc.url} download className="flex items-center gap-2">
                                <Download className="h-4 w-4" />
                                Download
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline">
              <Card>
                <CardHeader>
                  <CardTitle>Status Timeline</CardTitle>
                  <CardDescription>
                    History of all events and status changes for this enrollment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {enrollment.events.length === 0 ? (
                    <div className="text-center py-12">
                      <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No events recorded yet</p>
                    </div>
                  ) : (
                    <div className="relative space-y-6">
                      {/* Timeline line */}
                      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true" />

                      {enrollment.events.map((event, idx) => (
                        <div key={event.id} className="relative pl-10">
                          {/* Timeline dot */}
                          <div className="absolute left-0 top-1 h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <div className="h-3 w-3 rounded-full bg-blue-600" />
                          </div>

                          <div className="bg-white border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium capitalize">
                                {event.eventType.replace('_', ' ')}
                              </div>
                              <div className="text-sm text-gray-600">
                                {formatDateTime(event.timestamp)}
                              </div>
                            </div>

                            {event.status && (
                              <Badge variant="outline" className="mb-2 capitalize">
                                {event.status}
                              </Badge>
                            )}

                            {event.note && (
                              <p className="text-sm text-gray-600">{event.note}</p>
                            )}

                            {event.actor && (
                              <div className="text-xs text-gray-500 mt-2">
                                By: {event.actor}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  );
}

