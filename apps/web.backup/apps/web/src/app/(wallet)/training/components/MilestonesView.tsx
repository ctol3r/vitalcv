'use client';

import { Award, CheckCircle2, Circle, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

// ACGME Milestones Framework
const ACGME_MILESTONES: Record<string, { name: string; domain: string }> = {
  PC1: { name: 'Patient Care 1', domain: 'Patient Care' },
  PC2: { name: 'Patient Care 2', domain: 'Patient Care' },
  MK1: { name: 'Medical Knowledge 1', domain: 'Medical Knowledge' },
  MK2: { name: 'Medical Knowledge 2', domain: 'Medical Knowledge' },
  SBP1: { name: 'Systems-Based Practice 1', domain: 'Systems-Based Practice' },
  SBP2: { name: 'Systems-Based Practice 2', domain: 'Systems-Based Practice' },
  PBLI1: { name: 'Practice-Based Learning 1', domain: 'Practice-Based Learning' },
  PBLI2: { name: 'Practice-Based Learning 2', domain: 'Practice-Based Learning' },
  PROF1: { name: 'Professionalism 1', domain: 'Professionalism' },
  PROF2: { name: 'Professionalism 2', domain: 'Professionalism' },
  ICS1: { name: 'Interpersonal Communication 1', domain: 'Interpersonal Communication' },
  ICS2: { name: 'Interpersonal Communication 2', domain: 'Interpersonal Communication' },
};

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
  supervisorDID?: string;
  supervisorName?: string;
  chainAnchorHash?: string;
  notes?: string;
}

interface MilestonesViewProps {
  portfolioId: string;
  milestones: Milestone[];
  pgyLevel: number;
}

export default function MilestonesView({ portfolioId, milestones, pgyLevel }: MilestonesViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newMilestone, setNewMilestone] = useState({
    milestoneCode: '',
    milestoneName: '',
    domain: '',
    level: 1,
    supervisorDID: '',
    supervisorName: '',
    notes: '',
  });

  const handleAddMilestone = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/training/milestones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          pgyLevel,
          ...newMilestone,
        }),
      });

      if (!response.ok) throw new Error('Failed to add milestone');
      window.location.reload();
    } catch (error) {
      console.error('[milestones][add]', error);
      alert('Failed to add milestone');
    }
  };

  const handleCompleteMilestone = async (milestoneId: string, supervisorDID: string, supervisorName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorDID,
          supervisorName,
          chainAnchor: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to complete milestone');
      window.location.reload();
    } catch (error) {
      console.error('[milestones][complete]', error);
      alert('Failed to complete milestone');
    }
  };

  const milestonesByDomain = milestones.reduce((acc, m) => {
    if (!acc[m.domain]) acc[m.domain] = [];
    acc[m.domain].push(m);
    return acc;
  }, {} as Record<string, Milestone[]>);

  const completedCount = milestones.filter((m) => m.completed).length;
  const totalCount = milestones.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">ACGME Milestones</h2>
          <p className="text-sm text-muted-foreground">
            Track competency milestone progression (PGY-{pgyLevel})
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button>Add Milestone</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Milestone</DialogTitle>
              <DialogDescription>
                Add a new ACGME milestone to track
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Milestone Code</Label>
                <Select
                  value={newMilestone.milestoneCode}
                  onValueChange={(value) => {
                    const milestone = ACGME_MILESTONES[value];
                    setNewMilestone({
                      ...newMilestone,
                      milestoneCode: value,
                      milestoneName: milestone?.name || '',
                      domain: milestone?.domain || '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select milestone code" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACGME_MILESTONES).map(([code, { name }]) => (
                      <SelectItem key={code} value={code}>
                        {code} - {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Level (1-5)</Label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={newMilestone.level}
                  onChange={(e) =>
                    setNewMilestone({ ...newMilestone, level: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div>
                <Label>Supervisor Name</Label>
                <Input
                  value={newMilestone.supervisorName}
                  onChange={(e) =>
                    setNewMilestone({ ...newMilestone, supervisorName: e.target.value })
                  }
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Input
                  value={newMilestone.notes}
                  onChange={(e) => setNewMilestone({ ...newMilestone, notes: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>
              <Button onClick={handleAddMilestone} className="w-full">
                Add Milestone
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Progress Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Milestone Progress</CardTitle>
          <CardDescription>
            {completedCount} of {totalCount} milestones completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-2" />
          <p className="text-sm text-muted-foreground">
            {Math.round(progress)}% complete
          </p>
        </CardContent>
      </Card>

      {/* Milestones by Domain */}
      {Object.keys(milestonesByDomain).length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No milestones recorded yet. Add your first milestone to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(milestonesByDomain).map(([domain, domainMilestones]) => (
            <Card key={domain}>
              <CardHeader>
                <CardTitle className="text-lg">{domain}</CardTitle>
                <CardDescription>
                  {domainMilestones.filter((m) => m.completed).length} of {domainMilestones.length} completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {domainMilestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="flex items-center gap-3">
                        {milestone.completed ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {milestone.milestoneCode} - {milestone.milestoneName}
                            </span>
                            <Badge variant="outline">Level {milestone.level}</Badge>
                            {milestone.chainAnchorHash && (
                              <LinkIcon className="h-4 w-4 text-muted-foreground" title="Chain anchored" />
                            )}
                          </div>
                          {milestone.supervisorName && (
                            <p className="text-sm text-muted-foreground">
                              Supervisor: {milestone.supervisorName}
                            </p>
                          )}
                          {milestone.notes && (
                            <p className="text-sm text-muted-foreground mt-1">{milestone.notes}</p>
                          )}
                        </div>
                      </div>
                      {!milestone.completed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const supervisorDID = prompt('Supervisor DID:') || '';
                            const supervisorName = prompt('Supervisor Name:') || '';
                            if (supervisorDID && supervisorName) {
                              void handleCompleteMilestone(milestone.id, supervisorDID, supervisorName);
                            }
                          }}
                        >
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

