'use client';

import { useCallback, useEffect, useState } from 'react';
import { Brain, TrendingUp, Target, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface CompetencyHeatmap {
  strengths: Array<{ skill: string; score: number }>;
  gaps: Array<{ skill: string; requiredLevel: number; currentLevel: number }>;
}

interface CompetencySummary {
  totalSkills: number;
  avgLevel: number;
  recencyScore: number;
}

export default function CompetencyPage() {
  const [heatmap, setHeatmap] = useState<CompetencyHeatmap | null>(null);
  const [summary, setSummary] = useState<CompetencySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCompetency = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setHeatmap({ strengths: [], gaps: [] });
      setSummary({ totalSkills: 0, avgLevel: 0, recencyScore: 0 });
    } catch (error) {
      console.error('Failed to fetch competency:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetency();
  }, [fetchCompetency]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Competency Intelligence</h1>
          <p className="text-muted-foreground mt-2">
            Unified model assessing skills, training depth, recency, and performance signals
          </p>
        </div>
        <Button onClick={fetchCompetency} disabled={loading}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Total Skills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalSkills}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Average Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary.avgLevel * 100).toFixed(0)}%</div>
              <Progress value={summary.avgLevel * 100} className="mt-2" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Recency Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{(summary.recencyScore * 100).toFixed(0)}%</div>
              <Progress value={summary.recencyScore * 100} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Strengths
            </CardTitle>
            <CardDescription>Skills where you excel</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmap?.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">No strengths identified yet</p>
            ) : (
              <div className="space-y-2">
                {heatmap?.strengths.map((strength, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">{strength.skill}</span>
                    <Badge>{(strength.score * 100).toFixed(0)}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Skill Gaps
            </CardTitle>
            <CardDescription>Areas for improvement</CardDescription>
          </CardHeader>
          <CardContent>
            {heatmap?.gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skill gaps identified</p>
            ) : (
              <div className="space-y-2">
                {heatmap?.gaps.map((gap, idx) => (
                  <div key={idx} className="p-2 border rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{gap.skill}</span>
                      <Badge variant="secondary">
                        {gap.currentLevel.toFixed(1)} / {gap.requiredLevel.toFixed(1)}
                      </Badge>
                    </div>
                    <Progress value={(gap.currentLevel / gap.requiredLevel) * 100} className="h-1" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}








