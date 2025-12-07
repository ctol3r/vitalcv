'use client';

import { GraduationCap, Download, FileText, Link as LinkIcon, School } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface TrainingPortfolio {
  id: string;
  programName: string;
  pgyLevel: number;
  specialty?: string;
  institution?: string;
  startDate?: string;
  endDate?: string;
  rotations: any[];
  evaluations: any[];
  milestones: any[];
  procedures: any[];
}

interface EducationTranscriptViewProps {
  portfolioId: string;
  portfolio: TrainingPortfolio;
}

export default function EducationTranscriptView({ portfolioId, portfolio }: EducationTranscriptViewProps) {
  const [exporting, setExporting] = useState(false);
  const [transcriptData, setTranscriptData] = useState<any>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/training/transcript/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          transcriptType: 'residency',
        }),
      });

      if (!response.ok) throw new Error('Failed to export transcript');

      const data = await response.json();
      setTranscriptData(data);

      // Generate PDF (client-side using jsPDF or similar)
      // For now, we'll just show the data
      alert('Transcript exported! Chain hash: ' + data.chainHash);
    } catch (error) {
      console.error('[transcript][export]', error);
      alert('Failed to export transcript');
    } finally {
      setExporting(false);
    }
  };

  const completedMilestones = portfolio.milestones.filter((m: any) => m.completed).length;
  const totalMilestones = portfolio.milestones.length;

  const avgEvaluationScore =
    portfolio.evaluations.length > 0
      ? portfolio.evaluations.reduce((sum: number, e: any) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Education Transcript</h2>
          <p className="text-sm text-muted-foreground">
            Residency-ready, credentialed training history
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="h-5 w-5" />
            {portfolio.institution || 'Medical Institution'}
          </CardTitle>
          <CardDescription>
            {portfolio.programName} · PGY-{portfolio.pgyLevel}
            {portfolio.specialty && ` · ${portfolio.specialty}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Program Information */}
          <div>
            <h3 className="font-semibold mb-2">Program Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Program:</span>
                <p className="font-medium">{portfolio.programName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PGY Level:</span>
                <p className="font-medium">PGY-{portfolio.pgyLevel}</p>
              </div>
              {portfolio.specialty && (
                <div>
                  <span className="text-muted-foreground">Specialty:</span>
                  <p className="font-medium">{portfolio.specialty}</p>
                </div>
              )}
              {portfolio.startDate && (
                <div>
                  <span className="text-muted-foreground">Start Date:</span>
                  <p className="font-medium">
                    {new Date(portfolio.startDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Summary Statistics */}
          <div>
            <h3 className="font-semibold mb-2">Training Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Rotations</p>
                <p className="text-2xl font-bold">{portfolio.rotations.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Evaluations</p>
                <p className="text-2xl font-bold">{portfolio.evaluations.length}</p>
                {avgEvaluationScore !== null && (
                  <p className="text-xs text-muted-foreground">
                    Avg: {avgEvaluationScore.toFixed(1)}/5
                  </p>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Milestones</p>
                <p className="text-2xl font-bold">
                  {completedMilestones}/{totalMilestones}
                </p>
                <Progress
                  value={totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0}
                  className="mt-2 h-1"
                />
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground mb-1">Procedures</p>
                <p className="text-2xl font-bold">{portfolio.procedures.length}</p>
              </div>
            </div>
          </div>

          {/* Rotations Summary */}
          {portfolio.rotations.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Rotations</h3>
              <div className="space-y-2">
                {portfolio.rotations.map((rotation: any) => (
                  <div
                    key={rotation.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{rotation.rotationName}</p>
                      <p className="text-muted-foreground">
                        {new Date(rotation.startDate).toLocaleDateString()} -{' '}
                        {new Date(rotation.endDate).toLocaleDateString()}
                      </p>
                    </div>
                    {rotation.supervisingPhysician && (
                      <Badge variant="outline">{rotation.supervisingPhysician}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones Summary */}
          {portfolio.milestones.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Milestones Achieved</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {portfolio.milestones
                  .filter((m: any) => m.completed)
                  .map((milestone: any) => (
                    <div
                      key={milestone.id}
                      className="rounded-lg border p-2 text-sm"
                    >
                      <p className="font-medium">{milestone.milestoneCode}</p>
                      <p className="text-xs text-muted-foreground">{milestone.milestoneName}</p>
                      {milestone.chainAnchorHash && (
                        <LinkIcon className="h-3 w-3 text-muted-foreground mt-1" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Chain Metadata */}
          {transcriptData?.chainHash && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <LinkIcon className="h-4 w-4 text-emerald-700" />
                <p className="font-semibold text-emerald-900">Chain-Backed Transcript</p>
              </div>
              <p className="text-xs text-emerald-800 font-mono break-all">
                Hash: {transcriptData.chainHash}
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                This transcript is cryptographically anchored to the blockchain for verification.
              </p>
            </div>
          )}

          {/* Training Strengths & Weaknesses (AI Analysis) */}
          <div>
            <h3 className="font-semibold mb-2">Training Analysis</h3>
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  AI analysis of training strengths and weaknesses will appear here after sufficient
                  data is collected.
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

