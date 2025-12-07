'use client';

import { ClipboardList, CheckCircle2, AlertCircle, Link as LinkIcon, Award } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

interface ProcedureLog {
  id: string;
  procedureType: string;
  procedureCode?: string;
  complexity: string;
  supervisionLevel: string;
  outcome: string;
  attendingName?: string;
  attendingDID?: string;
  supervisorAttested: boolean;
  attestationDate?: string;
  milestoneCodes: string[];
  chainAnchorHash?: string;
  createdAt: string;
}

interface ProcedureLogsViewProps {
  portfolioId: string;
  procedures: ProcedureLog[];
}

export default function ProcedureLogsView({ portfolioId, procedures }: ProcedureLogsViewProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newProcedure, setNewProcedure] = useState({
    procedureType: '',
    procedureCode: '',
    complexity: 'low',
    supervisionLevel: 'direct',
    outcome: 'successful',
    attendingDID: '',
    attendingName: '',
    milestoneCodes: [] as string[],
  });

  const handleAddProcedure = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/training/procedures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          ...newProcedure,
          chainAnchor: newProcedure.complexity === 'high',
        }),
      });

      if (!response.ok) throw new Error('Failed to add procedure');
      window.location.reload();
    } catch (error) {
      console.error('[procedures][add]', error);
      alert('Failed to add procedure');
    }
  };

  const handleAttest = async (procedureId: string, attendingDID: string, attendingName: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/training/procedures/${procedureId}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendingDID,
          attendingName,
        }),
      });

      if (!response.ok) throw new Error('Failed to attest procedure');
      window.location.reload();
    } catch (error) {
      console.error('[procedures][attest]', error);
      alert('Failed to attest procedure');
    }
  };

  // Calculate competency clock
  const procedureCounts = procedures.reduce((acc, p) => {
    acc[p.procedureType] = (acc[p.procedureType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const independentProcedures = procedures.filter(
    (p) => p.supervisionLevel === 'independent' && p.outcome === 'successful'
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Procedure & Case Logs</h2>
          <p className="text-sm text-muted-foreground">
            Track procedures for privileging & skills verification
          </p>
        </div>
        <Dialog open={isAdding} onOpenChange={setIsAdding}>
          <DialogTrigger asChild>
            <Button>Log Procedure</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Procedure</DialogTitle>
              <DialogDescription>
                Record a procedure or case for your training portfolio
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Procedure Type</Label>
                <Input
                  value={newProcedure.procedureType}
                  onChange={(e) =>
                    setNewProcedure({ ...newProcedure, procedureType: e.target.value })
                  }
                  placeholder="e.g., Central Line Placement"
                />
              </div>
              <div>
                <Label>Procedure Code (CPT)</Label>
                <Input
                  value={newProcedure.procedureCode}
                  onChange={(e) =>
                    setNewProcedure({ ...newProcedure, procedureCode: e.target.value })
                  }
                  placeholder="Optional CPT code"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Complexity</Label>
                  <Select
                    value={newProcedure.complexity}
                    onValueChange={(value) =>
                      setNewProcedure({ ...newProcedure, complexity: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Supervision Level</Label>
                  <Select
                    value={newProcedure.supervisionLevel}
                    onValueChange={(value) =>
                      setNewProcedure({ ...newProcedure, supervisionLevel: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="indirect">Indirect</SelectItem>
                      <SelectItem value="independent">Independent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Outcome</Label>
                <Select
                  value={newProcedure.outcome}
                  onValueChange={(value) =>
                    setNewProcedure({ ...newProcedure, outcome: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="successful">Successful</SelectItem>
                    <SelectItem value="complication">Complication</SelectItem>
                    <SelectItem value="unsuccessful">Unsuccessful</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Attending Physician</Label>
                <Input
                  value={newProcedure.attendingName}
                  onChange={(e) =>
                    setNewProcedure({ ...newProcedure, attendingName: e.target.value })
                  }
                  placeholder="Dr. Jane Smith"
                />
              </div>
              <Button onClick={handleAddProcedure} className="w-full">
                Log Procedure
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Competency Clock */}
      {independentProcedures > 0 && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <Award className="h-5 w-5" />
              Competency Clock
            </CardTitle>
            <CardDescription className="text-emerald-800">
              You have {independentProcedures} independent successful procedures logged
            </CardDescription>
          </CardHeader>
          <CardContent>
            {Object.entries(procedureCounts)
              .filter(([, count]) => count >= 25)
              .map(([type, count]) => (
                <div key={type} className="mb-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{type}</span>
                    <Badge variant="outline" className="bg-white">
                      {count} procedures
                    </Badge>
                  </div>
                  <p className="text-sm text-emerald-800">
                    You are now independent in {type} after {count} successful logs
                  </p>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Procedures List */}
      {procedures.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No procedures logged yet. Log your first procedure to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {procedures.map((procedure) => (
            <Card key={procedure.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{procedure.procedureType}</CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      {procedure.procedureCode && (
                        <Badge variant="outline">CPT: {procedure.procedureCode}</Badge>
                      )}
                      <Badge
                        variant={
                          procedure.complexity === 'high'
                            ? 'destructive'
                            : procedure.complexity === 'medium'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {procedure.complexity}
                      </Badge>
                      <Badge variant="outline">{procedure.supervisionLevel}</Badge>
                      {procedure.chainAnchorHash && (
                        <LinkIcon className="h-4 w-4 text-muted-foreground" title="Chain anchored" />
                      )}
                    </CardDescription>
                  </div>
                  {procedure.supervisorAttested ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" title="Attested" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" title="Not attested" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Outcome:</span>
                    <Badge
                      variant={
                        procedure.outcome === 'successful'
                          ? 'default'
                          : procedure.outcome === 'complication'
                          ? 'secondary'
                          : 'destructive'
                      }
                      className="ml-2"
                    >
                      {procedure.outcome}
                    </Badge>
                  </div>
                  {procedure.attendingName && (
                    <div>
                      <span className="text-muted-foreground">Attending:</span>
                      <span className="ml-2 font-medium">{procedure.attendingName}</span>
                    </div>
                  )}
                </div>

                {procedure.milestoneCodes.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Completes Milestones:</p>
                    <div className="flex flex-wrap gap-1">
                      {procedure.milestoneCodes.map((code) => (
                        <Badge key={code} variant="outline" className="text-xs">
                          {code}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {!procedure.supervisorAttested && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const attendingDID = prompt('Attending DID:') || '';
                      const attendingName = prompt('Attending Name:') || '';
                      if (attendingDID && attendingName) {
                        void handleAttest(procedure.id, attendingDID, attendingName);
                      }
                    }}
                  >
                    Request Attestation
                  </Button>
                )}

                <p className="text-xs text-muted-foreground">
                  {new Date(procedure.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

