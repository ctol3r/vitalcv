'use client';

import { GraduationCap, BookOpen, ClipboardList, FileText, Award, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RotationsView from './components/RotationsView';
import EvaluationsView from './components/EvaluationsView';
import MilestonesView from './components/MilestonesView';
import ProcedureLogsView from './components/ProcedureLogsView';
import EducationTranscriptView from './components/EducationTranscriptView';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface TrainingPortfolio {
  id: string;
  clinicianId: string;
  clinicianDID?: string;
  programName: string;
  pgyLevel: number;
  specialty?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  rotations: Rotation[];
  evaluations: Evaluation[];
  milestones: Milestone[];
  procedures: ProcedureLog[];
  feedback: Feedback[];
}

interface Rotation {
  id: string;
  rotationName: string;
  rotationType?: string;
  startDate: string;
  endDate: string;
  supervisingPhysician?: string;
  supervisorDID?: string;
  progress: number;
  performanceSummary?: string;
  chainAnchorHash?: string;
}

interface Evaluation {
  id: string;
  rotationId?: string;
  supervisorName?: string;
  supervisorDID?: string;
  clinicalReasoning?: number;
  communication?: number;
  collaboration?: number;
  professionalism?: number;
  proceduralSkills?: number;
  narrativeFeedback?: string;
  createdAt: string;
}

interface Milestone {
  id: string;
  milestoneCode: string;
  milestoneName: string;
  domain: string;
  pgyLevel: number;
  level: number;
  completed: boolean;
  completedAt?: string;
  supervisorSigned: boolean;
  chainAnchorHash?: string;
}

interface ProcedureLog {
  id: string;
  procedureType: string;
  procedureCode?: string;
  complexity: string;
  supervisionLevel: string;
  outcome: string;
  attendingName?: string;
  supervisorAttested: boolean;
  createdAt: string;
}

interface Feedback {
  id: string;
  feedbackType: string;
  supervisorName?: string;
  content: string;
  createdAt: string;
}

export default function TrainingPortfolioPage() {
  const searchParams = useSearchParams();
  const clinicianId = searchParams.get('clinicianId') || searchParams.get('id');
  const [portfolio, setPortfolio] = useState<TrainingPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicianId) {
      setError('Missing clinicianId');
      setLoading(false);
      return;
    }

    const fetchPortfolio = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/training/portfolio/fetch?clinicianId=${clinicianId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch portfolio: ${response.status}`);
        }
        const data = await response.json();
        setPortfolio(data);
      } catch (err) {
        console.error('[training][portfolio]', err);
        setError(err instanceof Error ? err.message : 'Failed to load training portfolio');
      } finally {
        setLoading(false);
      }
    };

    void fetchPortfolio();
  }, [clinicianId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Training Portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">
              {error || 'Portfolio not found'}
            </p>
            {!portfolio && (
              <Button
                className="mt-4"
                onClick={() => {
                  // Create new portfolio
                  void fetch(`${API_BASE}/api/training/portfolio/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      clinicianId,
                      programName: 'New Program',
                      pgyLevel: 1,
                    }),
                  }).then(() => window.location.reload());
                }}
              >
                Create Portfolio
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const completedMilestones = portfolio.milestones.filter((m) => m.completed).length;
  const totalMilestones = portfolio.milestones.length;
  const milestoneProgress = totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

  const avgEvaluationScore =
    portfolio.evaluations.length > 0
      ? portfolio.evaluations.reduce((sum, e) => {
          const scores = [
            e.clinicalReasoning,
            e.communication,
            e.collaboration,
            e.professionalism,
            e.proceduralSkills,
          ].filter((s) => s !== null && s !== undefined) as number[];
          return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
        }, 0) / portfolio.evaluations.length
      : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Wallet · Training Portfolio</Badge>
          <Badge variant="outline">PGY-{portfolio.pgyLevel}</Badge>
          {portfolio.status === 'active' && (
            <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {portfolio.programName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {portfolio.institution && `${portfolio.institution} · `}
            {portfolio.specialty && `${portfolio.specialty} · `}
            Clinician ID: <span className="font-mono">{portfolio.clinicianId}</span>
          </p>
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rotations</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.rotations.length}</div>
            <p className="text-xs text-muted-foreground">Total rotations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Evaluations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.evaluations.length}</div>
            {avgEvaluationScore !== null && (
              <p className="text-xs text-muted-foreground">
                Avg: {avgEvaluationScore.toFixed(1)}/5
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Milestones</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedMilestones}/{totalMilestones}
            </div>
            <Progress value={milestoneProgress} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Procedures</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{portfolio.procedures.length}</div>
            <p className="text-xs text-muted-foreground">Case logs</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="rotations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rotations">
            <BookOpen className="mr-2 h-4 w-4" />
            Rotations
          </TabsTrigger>
          <TabsTrigger value="milestones">
            <Award className="mr-2 h-4 w-4" />
            Milestones
          </TabsTrigger>
          <TabsTrigger value="evaluations">
            <FileText className="mr-2 h-4 w-4" />
            Evaluations
          </TabsTrigger>
          <TabsTrigger value="procedures">
            <ClipboardList className="mr-2 h-4 w-4" />
            Procedures
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <GraduationCap className="mr-2 h-4 w-4" />
            Transcript
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rotations" className="space-y-4">
          <RotationsView portfolioId={portfolio.id} rotations={portfolio.rotations} />
        </TabsContent>

        <TabsContent value="milestones" className="space-y-4">
          <MilestonesView portfolioId={portfolio.id} milestones={portfolio.milestones} pgyLevel={portfolio.pgyLevel} />
        </TabsContent>

        <TabsContent value="evaluations" className="space-y-4">
          <EvaluationsView portfolioId={portfolio.id} evaluations={portfolio.evaluations} />
        </TabsContent>

        <TabsContent value="procedures" className="space-y-4">
          <ProcedureLogsView portfolioId={portfolio.id} procedures={portfolio.procedures} />
        </TabsContent>

        <TabsContent value="transcript" className="space-y-4">
          <EducationTranscriptView portfolioId={portfolio.id} portfolio={portfolio} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

