'use client';

import { Calendar, User, TrendingUp, Link as LinkIcon } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

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

interface RotationsViewProps {
  portfolioId: string;
  rotations: Rotation[];
}

export default function RotationsView({ portfolioId, rotations }: RotationsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newRotation, setNewRotation] = useState({
    rotationName: '',
    rotationType: '',
    startDate: '',
    endDate: '',
    supervisingPhysician: '',
    supervisorDID: '',
  });

  const handleAddRotation = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/training/rotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          ...newRotation,
        }),
      });

      if (!response.ok) throw new Error('Failed to add rotation');
      window.location.reload();
    } catch (error) {
      console.error('[rotations][add]', error);
      alert('Failed to add rotation');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Rotations</h2>
          <p className="text-sm text-muted-foreground">
            Track your residency rotations, competency goals, and progress
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button>Add Rotation</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Rotation</DialogTitle>
              <DialogDescription>
                Add a new rotation to your training portfolio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Rotation Name</Label>
                <Input
                  value={newRotation.rotationName}
                  onChange={(e) =>
                    setNewRotation({ ...newRotation, rotationName: e.target.value })
                  }
                  placeholder="e.g., Internal Medicine - Cardiology"
                />
              </div>
              <div>
                <Label>Rotation Type</Label>
                <Input
                  value={newRotation.rotationType}
                  onChange={(e) =>
                    setNewRotation({ ...newRotation, rotationType: e.target.value })
                  }
                  placeholder="inpatient|outpatient|elective|research"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={newRotation.startDate}
                    onChange={(e) =>
                      setNewRotation({ ...newRotation, startDate: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={newRotation.endDate}
                    onChange={(e) =>
                      setNewRotation({ ...newRotation, endDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Supervising Physician</Label>
                <Input
                  value={newRotation.supervisingPhysician}
                  onChange={(e) =>
                    setNewRotation({ ...newRotation, supervisingPhysician: e.target.value })
                  }
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <Button onClick={handleAddRotation} className="w-full">
                Add Rotation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {rotations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No rotations recorded yet. Add your first rotation to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rotations.map((rotation) => {
            const startDate = new Date(rotation.startDate);
            const endDate = new Date(rotation.endDate);
            const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            const today = new Date();
            const isActive = today >= startDate && today <= endDate;
            const isUpcoming = today < startDate;
            const isCompleted = today > endDate;

            return (
              <Card key={rotation.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{rotation.rotationName}</CardTitle>
                      <CardDescription className="mt-1">
                        {rotation.rotationType && (
                          <Badge variant="outline" className="mr-2">
                            {rotation.rotationType}
                          </Badge>
                        )}
                        {isActive && <Badge className="bg-emerald-50 text-emerald-700">Active</Badge>}
                        {isUpcoming && <Badge variant="secondary">Upcoming</Badge>}
                        {isCompleted && <Badge variant="outline">Completed</Badge>}
                      </CardDescription>
                    </div>
                    {rotation.chainAnchorHash && (
                      <LinkIcon className="h-4 w-4 text-muted-foreground" title="Chain anchored" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                      </span>
                      <span className="text-xs">({daysDiff} days)</span>
                    </div>
                    {rotation.supervisingPhysician && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{rotation.supervisingPhysician}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{Math.round(rotation.progress)}%</span>
                    </div>
                    <Progress value={rotation.progress} />
                  </div>

                  {rotation.performanceSummary && (
                    <div className="rounded-md border bg-muted/50 p-3 text-sm">
                      <p className="font-medium mb-1">Performance Summary</p>
                      <p className="text-muted-foreground">{rotation.performanceSummary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

