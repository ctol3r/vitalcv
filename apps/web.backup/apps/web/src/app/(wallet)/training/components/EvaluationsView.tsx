'use client';

import { FileText, Star, TrendingUp, AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

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
  visibilityToRecruiters?: boolean;
  anomalyFlagged?: boolean;
  anomalyReason?: string;
  chainAnchorHash?: string;
  createdAt: string;
}

interface EvaluationsViewProps {
  portfolioId: string;
  evaluations: Evaluation[];
}

export default function EvaluationsView({ portfolioId, evaluations }: EvaluationsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newEvaluation, setNewEvaluation] = useState({
    supervisorDID: '',
    supervisorName: '',
    clinicalReasoning: 3,
    communication: 3,
    collaboration: 3,
    professionalism: 3,
    proceduralSkills: 3,
    narrativeFeedback: '',
    visibilityToRecruiters: false,
  });

  const handleAddEvaluation = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/training/evaluations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          ...newEvaluation,
          chainAnchor: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to add evaluation');
      window.location.reload();
    } catch (error) {
      console.error('[evaluations][add]', error);
      alert('Failed to add evaluation');
    }
  };

  // Calculate trend data
  const trendData = evaluations
    .map((e, idx) => {
      const scores = [
        e.clinicalReasoning,
        e.communication,
        e.collaboration,
        e.professionalism,
        e.proceduralSkills,
      ].filter((s) => s !== null && s !== undefined) as number[];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      return {
        index: idx + 1,
        date: new Date(e.createdAt).toLocaleDateString(),
        average: avg,
      };
    })
    .reverse();

  const avgScore =
    evaluations.length > 0
      ? evaluations.reduce((sum, e) => {
          const scores = [
            e.clinicalReasoning,
            e.communication,
            e.collaboration,
            e.professionalism,
            e.proceduralSkills,
          ].filter((s) => s !== null && s !== undefined) as number[];
          return sum + (scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
        }, 0) / evaluations.length
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Evaluations</h2>
          <p className="text-sm text-muted-foreground">
            Supervisor assessments and performance feedback
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button>Submit Evaluation</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Evaluation</DialogTitle>
              <DialogDescription>
                Submit a supervisor evaluation for this trainee
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Supervisor DID</Label>
                <Input
                  value={newEvaluation.supervisorDID}
                  onChange={(e) =>
                    setNewEvaluation({ ...newEvaluation, supervisorDID: e.target.value })
                  }
                  placeholder="did:vital:supervisor123"
                />
              </div>
              <div>
                <Label>Supervisor Name</Label>
                <Input
                  value={newEvaluation.supervisorName}
                  onChange={(e) =>
                    setNewEvaluation({ ...newEvaluation, supervisorName: e.target.value })
                  }
                  placeholder="Dr. Jane Smith"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Clinical Reasoning: {newEvaluation.clinicalReasoning}/5</Label>
                  <Slider
                    value={[newEvaluation.clinicalReasoning]}
                    onValueChange={([value]) =>
                      setNewEvaluation({ ...newEvaluation, clinicalReasoning: value })
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Communication: {newEvaluation.communication}/5</Label>
                  <Slider
                    value={[newEvaluation.communication]}
                    onValueChange={([value]) =>
                      setNewEvaluation({ ...newEvaluation, communication: value })
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Collaboration: {newEvaluation.collaboration}/5</Label>
                  <Slider
                    value={[newEvaluation.collaboration]}
                    onValueChange={([value]) =>
                      setNewEvaluation({ ...newEvaluation, collaboration: value })
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Professionalism: {newEvaluation.professionalism}/5</Label>
                  <Slider
                    value={[newEvaluation.professionalism]}
                    onValueChange={([value]) =>
                      setNewEvaluation({ ...newEvaluation, professionalism: value })
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Procedural Skills: {newEvaluation.proceduralSkills}/5</Label>
                  <Slider
                    value={[newEvaluation.proceduralSkills]}
                    onValueChange={([value]) =>
                      setNewEvaluation({ ...newEvaluation, proceduralSkills: value })
                    }
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                  />
                </div>
              </div>

              <div>
                <Label>Narrative Feedback</Label>
                <Textarea
                  value={newEvaluation.narrativeFeedback}
                  onChange={(e) =>
                    setNewEvaluation({ ...newEvaluation, narrativeFeedback: e.target.value })
                  }
                  placeholder="Detailed feedback..."
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={newEvaluation.visibilityToRecruiters}
                  onCheckedChange={(checked) =>
                    setNewEvaluation({ ...newEvaluation, visibilityToRecruiters: checked })
                  }
                />
                <Label>Visible to recruiters</Label>
              </div>

              <Button onClick={handleAddEvaluation} className="w-full">
                Submit Evaluation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Performance Trend */}
      {evaluations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Trendline
            </CardTitle>
            <CardDescription>Average evaluation scores over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Line type="monotone" dataKey="average" stroke="#8884d8" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Evaluations List */}
      {evaluations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No evaluations recorded yet. Submit your first evaluation to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {evaluations.map((evaluation) => {
            const scores = [
              evaluation.clinicalReasoning,
              evaluation.communication,
              evaluation.collaboration,
              evaluation.professionalism,
              evaluation.proceduralSkills,
            ].filter((s) => s !== null && s !== undefined) as number[];
            const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

            return (
              <Card key={evaluation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        Evaluation
                        {evaluation.chainAnchorHash && (
                          <LinkIcon className="h-4 w-4 text-muted-foreground" title="Chain anchored" />
                        )}
                        {evaluation.anomalyFlagged && (
                          <AlertTriangle className="h-4 w-4 text-amber-600" title="Anomaly flagged" />
                        )}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {evaluation.supervisorName && (
                          <span>Supervisor: {evaluation.supervisorName}</span>
                        )}
                        {evaluation.visibilityToRecruiters && (
                          <Badge variant="outline" className="ml-2">
                            Visible to recruiters
                          </Badge>
                        )}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{avg.toFixed(1)}</div>
                      <div className="text-xs text-muted-foreground">Average</div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {evaluation.clinicalReasoning && (
                      <div>
                        <span className="text-muted-foreground">Clinical Reasoning:</span>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{evaluation.clinicalReasoning}/5</span>
                        </div>
                      </div>
                    )}
                    {evaluation.communication && (
                      <div>
                        <span className="text-muted-foreground">Communication:</span>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{evaluation.communication}/5</span>
                        </div>
                      </div>
                    )}
                    {evaluation.collaboration && (
                      <div>
                        <span className="text-muted-foreground">Collaboration:</span>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{evaluation.collaboration}/5</span>
                        </div>
                      </div>
                    )}
                    {evaluation.professionalism && (
                      <div>
                        <span className="text-muted-foreground">Professionalism:</span>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{evaluation.professionalism}/5</span>
                        </div>
                      </div>
                    )}
                    {evaluation.proceduralSkills && (
                      <div>
                        <span className="text-muted-foreground">Procedural Skills:</span>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">{evaluation.proceduralSkills}/5</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {evaluation.narrativeFeedback && (
                    <div className="rounded-md border bg-muted/50 p-3">
                      <p className="text-sm font-medium mb-1">Narrative Feedback</p>
                      <p className="text-sm text-muted-foreground">{evaluation.narrativeFeedback}</p>
                    </div>
                  )}

                  {evaluation.anomalyFlagged && evaluation.anomalyReason && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                      <p className="text-sm font-medium text-amber-900">Anomaly Detected</p>
                      <p className="text-sm text-amber-800">{evaluation.anomalyReason}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {new Date(evaluation.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

