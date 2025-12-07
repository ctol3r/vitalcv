'use client';

/**
 * Recruiter Home View - Main tab root for recruiter portal
 * Phase 1: Foundation & Navigation
 */

import { useRecruiter } from '@/contexts/RecruiterContext';
import { RecruiterTabs } from '@/components/recruiter/RecruiterTabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function RecruiterHomePage() {
  const { recruiterState, isLoading } = useRecruiter();
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl space-y-6 py-8">
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (recruiterState.state === 'error') {
    return (
      <div className="container mx-auto max-w-7xl py-8">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Recruiter Portal</AlertTitle>
          <AlertDescription>{recruiterState.error || 'Unknown error occurred'}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (recruiterState.state === 'ready' && !recruiterState.profile) {
    // Redirect to setup if no profile (client-side)
    if (typeof window !== 'undefined') {
      router.push('/recruiter/setup');
    }
    return null;
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Recruiter Portal
        </h1>
        <p className="text-muted-foreground">
          {recruiterState.profile?.organizationName
            ? `Welcome to ${recruiterState.profile.organizationName}`
            : 'Manage candidates, verify credentials, and match talent to opportunities'}
        </p>
      </header>

      <RecruiterTabs />
    </div>
  );
}

