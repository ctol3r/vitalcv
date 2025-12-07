'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  MapPin,
  DollarSign,
  Briefcase,
  Calendar,
  CheckCircle,
  Building2,
  Globe,
  Users
} from 'lucide-react';

interface JobPosting {
  id: string;
  title: string;
  description: string;
  specialty: string;
  location: {
    city?: string;
    state: string;
    zip?: string;
  };
  requiredStates: string[];
  modality: 'in-person' | 'telehealth' | 'hybrid';
  compRangeMin?: number;
  compRangeMax?: number;
  compCurrency: string;
  telehealth: boolean;
  imlcEligible: boolean;
  multiStateOk: boolean;
  status: 'active' | 'closed' | 'filled';
  partnerId: string;
  partnerName?: string;
  externalJobId?: string;
  createdAt: string;
  updatedAt: string;
}

export default function JobDetailPage() {
  const params = useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchJob() {
      try {
        const response = await fetch(`/api/jobs/${jobId}`);
        if (!response.ok) {
          throw new Error('Job not found');
        }
        const data = await response.json();
        setJob(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load job');
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [jobId]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">{error || 'Job not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatSalary = () => {
    if (!job.compRangeMin && !job.compRangeMax) {
      return 'Competitive';
    }
    const min = job.compRangeMin?.toLocaleString('en-US', { style: 'currency', currency: job.compCurrency });
    const max = job.compRangeMax?.toLocaleString('en-US', { style: 'currency', currency: job.compCurrency });
    if (min && max) {
      return `${min} - ${max}`;
    }
    return min || max || 'Competitive';
  };

  const formatLocation = () => {
    if (job.modality === 'telehealth') {
      return 'Remote (Telehealth)';
    }
    if (job.location.city && job.location.state) {
      return `${job.location.city}, ${job.location.state}`;
    }
    return job.location.state;
  };

  const handleApply = () => {
    // Trigger Apply with VitalCV widget
    if (typeof window !== 'undefined' && (window as any).VitalCV) {
      (window as any).VitalCV.apply({
        jobId: job.id,
        partnerId: job.partnerId,
      });
    } else {
      // Fallback: redirect to apply page
      window.location.href = `/apply/${job.id}`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Job Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">{job.title}</h1>
            {job.partnerName && (
              <div className="flex items-center gap-2 text-gray-600 mb-2">
                <Building2 className="h-5 w-5" />
                <span className="text-lg">{job.partnerName}</span>
              </div>
            )}
            <div className="flex flex-wrap gap-2 items-center text-gray-600">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span>{formatLocation()}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <Briefcase className="h-4 w-4" />
                <span>{job.modality}</span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                <span>{formatSalary()}</span>
              </div>
            </div>
          </div>
          {job.status === 'active' && (
            <Button onClick={handleApply} size="lg" className="ml-4">
              Apply with VitalCV
            </Button>
          )}
          {job.status === 'filled' && (
            <Badge variant="secondary">Filled</Badge>
          )}
          {job.status === 'closed' && (
            <Badge variant="outline">Closed</Badge>
          )}
        </div>

        {/* Key Features */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">
            <CheckCircle className="h-3 w-3 mr-1" />
            {job.specialty}
          </Badge>
          {job.telehealth && (
            <Badge variant="outline">
              <Globe className="h-3 w-3 mr-1" />
              Telehealth
            </Badge>
          )}
          {job.imlcEligible && (
            <Badge variant="outline">
              <Users className="h-3 w-3 mr-1" />
              IMLC Eligible
            </Badge>
          )}
          {job.multiStateOk && (
            <Badge variant="outline">
              Multi-State OK
            </Badge>
          )}
        </div>
      </div>

      {/* Job Description */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Job Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: job.description }}
          />
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Required Licenses</h4>
              <div className="flex flex-wrap gap-2">
                {job.requiredStates.map((state) => (
                  <Badge key={state} variant="secondary">
                    {state}
                  </Badge>
                ))}
              </div>
              {job.imlcEligible && (
                <p className="text-sm text-gray-600 mt-2">
                  IMLC-eligible physicians may practice across 40+ states
                </p>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Specialty</h4>
              <Badge variant="outline">{job.specialty}</Badge>
            </div>

            {job.modality === 'telehealth' && (
              <div>
                <h4 className="font-semibold mb-2">Work Environment</h4>
                <p className="text-sm text-gray-600">
                  This is a 100% remote telehealth position. Provide care from anywhere with appropriate state licensure.
                </p>
              </div>
            )}

            {job.modality === 'hybrid' && (
              <div>
                <h4 className="font-semibold mb-2">Work Environment</h4>
                <p className="text-sm text-gray-600">
                  Hybrid role combining in-person care at {formatLocation()} and remote telehealth services.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apply Section */}
      {job.status === 'active' && (
        <Card>
          <CardHeader>
            <CardTitle>Ready to Apply?</CardTitle>
            <CardDescription>
              Use your VitalCV credentials to apply instantly with verified healthcare qualifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={handleApply} size="lg" className="flex-1">
                Apply with VitalCV
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="flex-1"
                onClick={() => window.open(`https://${job.partnerName?.toLowerCase().replace(/\s+/g, '-')}.com/jobs/${job.externalJobId}`, '_blank')}
              >
                View on Company Site
              </Button>
            </div>

            {/* VitalCV Widget Embed Point */}
            <div id="vitalcv-apply-widget" className="mt-4" />

            <div className="mt-6 text-sm text-gray-600">
              <p className="font-semibold mb-2">Why Apply with VitalCV?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Instant application with verified credentials</li>
                <li>Automatic license verification</li>
                <li>HIPAA-compliant data sharing</li>
                <li>Track your application status in real-time</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posted Date */}
      <div className="mt-6 text-sm text-gray-500 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        <span>
          Posted {new Date(job.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </span>
      </div>
    </div>
  );
}

