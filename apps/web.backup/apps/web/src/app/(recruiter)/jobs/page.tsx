'use client';

/**
 * Recruiter Jobs View - Job listings and matching
 * Phase 5 Task 36: Privilege Required marker in Jobs Portal
 */

import { useState, useEffect } from 'react';
import { Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PrivilegeRequiredBadge } from '@/components/privileges/PrivilegeRequiredBadge';

interface Job {
  id: string;
  title: string;
  facility: string;
  unit: string;
  specialty: string;
  requiredPrivileges: string[];
  description: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  async function loadJobs() {
    setLoading(true);
    try {
      // Mock data for now - replace with actual API call
      const mockJobs: Job[] = [
        {
          id: 'job-1',
          title: 'Cardiologist - Interventional',
          facility: 'General Hospital',
          unit: 'Cardiology',
          specialty: 'Cardiology',
          requiredPrivileges: ['CARD-CATH-ADULT', 'CARD-PCI'],
          description: 'Seeking board-certified interventional cardiologist with catheterization and PCI privileges.',
        },
        {
          id: 'job-2',
          title: 'Critical Care Physician',
          facility: 'General Hospital',
          unit: 'ICU',
          specialty: 'Critical Care',
          requiredPrivileges: ['ICU-VENT', 'ICU-CVC'],
          description: 'Critical care physician needed for ICU coverage with mechanical ventilation and central line privileges.',
        },
        {
          id: 'job-3',
          title: 'General Surgeon',
          facility: 'General Hospital',
          unit: 'OR',
          specialty: 'General Surgery',
          requiredPrivileges: ['OR-GEN-SURG'],
          description: 'General surgeon with operating room privileges needed for surgical services.',
        },
      ];
      setJobs(mockJobs);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl space-y-6 py-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Open Positions</h1>
        <p className="text-muted-foreground">
          Manage job postings and match candidates to opportunities.
        </p>
      </header>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-24 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>{job.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {job.facility} · {job.unit}
                    </CardDescription>
                  </div>
                  {job.requiredPrivileges.length > 0 && (
                    <PrivilegeRequiredBadge privilegeCodes={job.requiredPrivileges} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{job.description}</p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{job.specialty}</Badge>
                  <Badge variant="outline">{job.unit}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button variant="default">View Details</Button>
                  <Button variant="outline">Match Candidates</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

