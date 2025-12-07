'use client';

import { useEffect, useState } from 'react';
import { Briefcase, GraduationCap, MapPin, TrendingUp, RefreshCcw, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface OpportunityProfile {
  jobs?: Array<{ jobId: string; title: string; matchScore: number }>;
  privileges?: Array<{ privilegeId: string; name: string; estimatedTime: number }>;
  training?: Array<{ type: string; name: string; urgency: string }>;
  states?: Record<string, any>;
  career?: Array<{ role: string; timeline: string; probability: number }>;
}

export default function OpportunitiesPage() {
  const [profile, setProfile] = useState<OpportunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId, setClinicianId] = useState('');

  useEffect(() => {
    setClinicianId('demo_clinician_123');
    loadOpportunities('demo_clinician_123');
  }, []);

  async function loadOpportunities(id: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${id}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data.opportunities || {});
      }
    } catch (error) {
      console.error('Failed to load opportunities:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleAnchor() {
    try {
      const response = await fetch(`${API_BASE}/api/opportunities/${clinicianId}/anchor`, {
        method: 'POST',
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Anchored! TX: ${data.txHash}`);
      }
    } catch (error) {
      console.error('Failed to anchor:', error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Opportunities</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Career Opportunities</h1>
            <p className="text-muted-foreground">
              AI-powered discovery of jobs, privileges, training, and mobility pathways
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => loadOpportunities(clinicianId)}
              disabled={loading}
            >
              <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button variant="outline" onClick={handleAnchor}>
              Anchor Snapshot
            </Button>
          </div>
        </div>
      </header>

      {profile && (
        <div className="grid gap-6 md:grid-cols-2">
          {profile.jobs && profile.jobs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Job Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.jobs.slice(0, 5).map((job) => (
                    <div key={job.jobId} className="rounded-lg border p-3">
                      <div className="font-semibold">{job.title}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="secondary">Match: {job.matchScore}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {profile.privileges && profile.privileges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privilege Expansion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.privileges.map((priv) => (
                    <div key={priv.privilegeId} className="rounded-lg border p-3">
                      <div className="font-semibold">{priv.name}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Est. {priv.estimatedTime} days
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {profile.training && profile.training.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Training Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.training.map((train, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="font-semibold">{train.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge
                          variant={
                            train.urgency === 'high'
                              ? 'destructive'
                              : train.urgency === 'medium'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {train.urgency}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{train.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {profile.career && profile.career.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Career Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {profile.career.map((pred, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="font-semibold">{pred.role}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline">{pred.timeline}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(pred.probability * 100)}% probability
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

