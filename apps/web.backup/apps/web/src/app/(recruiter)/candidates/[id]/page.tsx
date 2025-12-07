'use client';

/**
 * Recruiter Candidate Profile View
 * Phase 4: Candidate Profile
 *
 * Features:
 * - Specialty + experience timeline
 * - Credential list with trust glows
 * - Compliance summary (License, DEA, NPDB, Sanctions)
 * - "Re-Verify Now" button
 * - "Share Candidate Packet" (DPoP-bound secure link)
 * - "Candidate Fit" engine summary
 * - Deep link: vitalcv://candidate/:id
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  User,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
  RefreshCw,
  ExternalLink,
  FileText,
  Award,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CandidateProfile {
  candidateId: string;
  name: string;
  headshotUrl?: string;
  specialty: string;
  experience: Array<{
    role: string;
    organization: string;
    startDate: string;
    endDate?: string;
    current: boolean;
  }>;
  credentials: Array<{
    type: string;
    issuer: string;
    issuedDate: string;
    expiryDate?: string;
    trustScore: number;
    status: 'active' | 'expired' | 'pending';
  }>;
  compliance: {
    license: {
      number: string;
      state: string;
      status: 'active' | 'expired';
    };
    dea: {
      number?: string;
      status: 'active' | 'expired' | 'none';
    };
    npdb: {
      clear: boolean;
      lastChecked?: string;
    };
    sanctions: {
      clear: boolean;
      lastChecked?: string;
    };
  };
  trustScore: number;
  matchScore?: number;
  lastVerifiedAt?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function RecruiterCandidateProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const candidateId = params.id as string;

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    void loadProfile();
  }, [candidateId]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      // const response = await fetch(`${API_BASE}/api/recruiter/candidates/${candidateId}`);
      // const data = await response.json();

      // Mock data for now
      const mockProfile: CandidateProfile = {
        candidateId,
        name: `Dr. ${candidateId}`,
        specialty: 'Emergency Medicine',
        experience: [
          {
            role: 'Attending Physician',
            organization: 'City General Hospital',
            startDate: '2020-01-01',
            current: true,
          },
          {
            role: 'Resident',
            organization: 'University Medical Center',
            startDate: '2017-07-01',
            endDate: '2019-12-31',
            current: false,
          },
        ],
        credentials: [
          {
            type: 'Medical License',
            issuer: 'State Medical Board',
            issuedDate: '2017-06-01',
            trustScore: 95,
            status: 'active',
          },
          {
            type: 'Board Certification',
            issuer: 'American Board of Emergency Medicine',
            issuedDate: '2019-12-01',
            trustScore: 98,
            status: 'active',
          },
        ],
        compliance: {
          license: {
            number: 'MD-12345',
            state: 'CA',
            status: 'active',
          },
          dea: {
            number: 'DEA-AB1234567',
            status: 'active',
          },
          npdb: {
            clear: true,
            lastChecked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
          sanctions: {
            clear: true,
            lastChecked: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        trustScore: 92,
        matchScore: 88,
        lastVerifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      };

      setProfile(mockProfile);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to load candidate profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReVerify = async () => {
    setVerifying(true);
    try {
      // Navigate to scan page with candidate pre-filled
      router.push(`/recruiter/scan?candidateId=${candidateId}`);
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to start verification',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSharePacket = async () => {
    try {
      const shareUrl = `${window.location.origin}/recruiter/candidates/${candidateId}/packet`;
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: 'Link Copied',
        description: 'Candidate packet link copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to copy link',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-6xl space-y-6 py-8">
        <div className="space-y-4">
          <div className="h-8 w-64 bg-slate-200 animate-pulse rounded" />
          <div className="h-4 w-96 bg-slate-200 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto max-w-6xl py-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">Candidate not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const daysSinceVerification = profile.lastVerifiedAt
    ? Math.floor((Date.now() - new Date(profile.lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={profile.headshotUrl} alt={profile.name} />
            <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-lg">
              {initials || <User className="h-8 w-8" />}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-3xl font-bold">{profile.name}</h1>
            <p className="text-muted-foreground">{profile.specialty}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReVerify} disabled={verifying}>
            <RefreshCw className={cn('mr-2 h-4 w-4', verifying && 'animate-spin')} />
            Re-Verify Now
          </Button>
          <Button variant="outline" onClick={handleSharePacket}>
            <Share2 className="mr-2 h-4 w-4" />
            Share Packet
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Experience Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Experience Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {profile.experience.map((exp, idx) => (
                  <div key={idx} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      {idx < profile.experience.length - 1 && (
                        <div className="h-full w-0.5 bg-slate-200 dark:bg-slate-700 mt-2" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{exp.role}</p>
                          <p className="text-sm text-muted-foreground">{exp.organization}</p>
                        </div>
                        <Badge variant="outline">
                          {new Date(exp.startDate).getFullYear()} - {exp.current ? 'Present' : new Date(exp.endDate!).getFullYear()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Credentials with Trust Glows */}
          <Card>
            <CardHeader>
              <CardTitle>Credentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {profile.credentials.map((cred, idx) => (
                <div
                  key={idx}
                  className={cn(
                    'rounded-lg border p-4 transition-all',
                    cred.trustScore >= 90 && 'border-green-200 bg-green-50/50 dark:bg-green-950/20',
                    cred.trustScore >= 70 && cred.trustScore < 90 && 'border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20',
                    cred.trustScore < 70 && 'border-red-200 bg-red-50/50 dark:bg-red-950/20'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{cred.type}</p>
                      <p className="text-sm text-muted-foreground">{cred.issuer}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        Trust: {cred.trustScore}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {cred.status === 'active' ? 'Active' : cred.status === 'expired' ? 'Expired' : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trust Score */}
          <Card>
            <CardHeader>
              <CardTitle>Trust Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center">
                <div className="relative h-24 w-24">
                  <svg className="h-24 w-24 transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="40"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${(profile.trustScore / 100) * 251.2} 251.2`}
                      className="text-blue-600 dark:text-blue-400"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold">{profile.trustScore}</span>
                  </div>
                </div>
              </div>
              {daysSinceVerification !== null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center">
                  <Clock className="h-4 w-4" />
                  <span>Verified {daysSinceVerification} day{daysSinceVerification !== 1 ? 's' : ''} ago</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Compliance Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">License</span>
                  <Badge variant={profile.compliance.license.status === 'active' ? 'default' : 'destructive'}>
                    {profile.compliance.license.status === 'active' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {profile.compliance.license.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">DEA</span>
                  <Badge variant={profile.compliance.dea.status === 'active' ? 'default' : 'destructive'}>
                    {profile.compliance.dea.status === 'active' ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {profile.compliance.dea.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">NPDB</span>
                  <Badge variant={profile.compliance.npdb.clear ? 'default' : 'destructive'}>
                    {profile.compliance.npdb.clear ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {profile.compliance.npdb.clear ? 'Clear' : 'Action Required'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Sanctions</span>
                  <Badge variant={profile.compliance.sanctions.clear ? 'default' : 'destructive'}>
                    {profile.compliance.sanctions.clear ? (
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 mr-1" />
                    )}
                    {profile.compliance.sanctions.clear ? 'Clear' : 'Action Required'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Candidate Fit */}
          {profile.matchScore && (
            <Card>
              <CardHeader>
                <CardTitle>Candidate Fit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Match Score</span>
                  <span className="text-lg font-semibold">{profile.matchScore}%</span>
                </div>
                <Progress value={profile.matchScore} />
                <p className="text-xs text-muted-foreground">
                  Based on credentials, experience, and specialty match
                </p>
              </CardContent>
            </Card>
          )}

          {/* Deep Link */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Access</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const deepLink = `vitalcv://candidate/${candidateId}`;
                  window.location.href = deepLink;
                }}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open in App
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

