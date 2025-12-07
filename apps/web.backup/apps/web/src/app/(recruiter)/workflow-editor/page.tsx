'use client';

import { useEffect, useState } from 'react';
import { Calendar, RefreshCcw, Settings, TrendingUp } from 'lucide-react';
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

export default function RecruiterWorkflowEditorPage() {
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    setLoading(true);
    try {
      // Placeholder - would fetch from API
      setWorkflows([]);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Recruiter · Workflow Editor</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Recruiter Workflow Automation</h1>
            <p className="text-muted-foreground">
              End-to-end automation from job posting → candidate selection → interview → onboarding
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadWorkflows}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Auto-Posting
            </CardTitle>
            <CardDescription>Automatically post jobs based on staffing needs</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Configure
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Candidate Ranking
            </CardTitle>
            <CardDescription>Rank candidates by skill fit, readiness, and reliability</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              View Rankings
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Calendar Sync
            </CardTitle>
            <CardDescription>Sync interview calendar with Google/Outlook</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Connect Calendar
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Steps</CardTitle>
          <CardDescription>Configure automated workflow steps</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">Job Posting</p>
                <p className="text-sm text-muted-foreground">Auto-post based on staffing needs</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">Candidate Ranking</p>
                <p className="text-sm text-muted-foreground">Rank by skill fit, readiness, reliability</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">Interview Scheduling</p>
                <p className="text-sm text-muted-foreground">Sync with calendar systems</p>
              </div>
              <Badge variant="secondary">Inactive</Badge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <div>
                <p className="font-medium">Auto Follow-up</p>
                <p className="text-sm text-muted-foreground">Send reminders based on engagement</p>
              </div>
              <Badge variant="secondary">Inactive</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

