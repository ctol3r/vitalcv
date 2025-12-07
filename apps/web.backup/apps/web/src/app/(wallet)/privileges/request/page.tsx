/**
 * Facility Privileging Engine - Privilege Request View
 * Phase 3: Privilege Request & Verification Flow
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Shield,
  Upload,
  XCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { Privilege, PrivilegeRequest } from '@/lib/privileging/models';
import { facilityPrivilegeSets } from '@/lib/privileging/facilityPrivilegeSets';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

export default function PrivilegeRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestId = searchParams.get('id');

  const [selectedPrivilege, setSelectedPrivilege] = useState<Privilege | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [evidence, setEvidence] = useState<Array<{ type: string; file?: File; url?: string }>>([]);
  const [skillAttestations, setSkillAttestations] = useState<Array<{ skillName: string; attestedBy: string; required: boolean }>>([]);
  const [readinessScore, setReadinessScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<PrivilegeRequest | null>(null);

  // Load existing request if ID provided
  useEffect(() => {
    if (requestId) {
      loadExistingRequest(requestId);
    }
  }, [requestId]);

  // Calculate readiness score when selections change
  useEffect(() => {
    if (selectedPrivilege) {
      calculateReadinessScore();
    }
  }, [selectedPrivilege, evidence, skillAttestations]);

  async function loadExistingRequest(id: string) {
    try {
      const response = await fetch(`${API_BASE}/api/facility/privileges/request/${id}`);
      if (response.ok) {
        const data = await response.json();
        setExistingRequest(data);
        if (data.privilegeCode) {
          const privilege = findPrivilegeByCode(data.privilegeCode);
          if (privilege) {
            setSelectedPrivilege(privilege);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load request:', error);
    }
  }

  function findPrivilegeByCode(code: string): Privilege | null {
    for (const set of facilityPrivilegeSets) {
      const privilege = set.privileges.find((p) => p.privilegeCode === code);
      if (privilege) return privilege;
    }
    return null;
  }

  function calculateReadinessScore() {
    if (!selectedPrivilege) {
      setReadinessScore(0);
      return;
    }

    let score = 0;
    const maxScore = 100;

    // Evidence submission (40 points)
    const requiredEvidenceTypes = [
      ...selectedPrivilege.requiredCredentials.map((c) => `credential:${c}`),
      ...(selectedPrivilege.deaRequired ? ['dea'] : []),
      ...(selectedPrivilege.mateRequired ? ['mate'] : []),
    ];
    const submittedEvidence = evidence.length;
    const requiredEvidence = requiredEvidenceTypes.length;
    score += (submittedEvidence / Math.max(requiredEvidence, 1)) * 40;

    // Skill attestations (40 points)
    const requiredSkills = selectedPrivilege.requiredSkills;
    const submittedAttestations = skillAttestations.filter((a) => a.attestedBy).length;
    score += (submittedAttestations / Math.max(requiredSkills.length, 1)) * 40;

    // Privilege selection (20 points)
    if (selectedPrivilege) {
      score += 20;
    }

    setReadinessScore(Math.min(maxScore, Math.round(score)));
  }

  async function handleSubmit() {
    if (!selectedPrivilege) {
      alert('Please select a privilege');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('privilegeCode', selectedPrivilege.privilegeCode);
      formData.append('facilityId', 'FACILITY-001'); // TODO: Get from context
      formData.append('evidence', JSON.stringify(evidence.map((e) => ({ type: e.type }))));
      formData.append('skillAttestations', JSON.stringify(skillAttestations));

      // Append files
      for (const item of evidence) {
        if (item.file) {
          formData.append('files', item.file);
        }
      }

      const response = await fetch(`${API_BASE}/api/facility/privileges/request`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/privileges/request?id=${data.id}`);
      } else {
        const error = await response.json();
        alert(`Failed to submit request: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to submit request:', error);
      alert('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEvidenceUpload(type: string, file: File) {
    setEvidence((prev) => [...prev, { type, file }]);
  }

  function handleSkillAttestation(skillName: string, attestedBy: string) {
    setSkillAttestations((prev) => {
      const existing = prev.find((a) => a.skillName === skillName);
      if (existing) {
        return prev.map((a) =>
          a.skillName === skillName ? { ...a, attestedBy } : a
        );
      }
      return [...prev, { skillName, attestedBy, required: true }];
    });
  }

  // Get available privileges by category
  const availablePrivileges = selectedCategory
    ? facilityPrivilegeSets
        .find((set) => set.unit === selectedCategory)
        ?.privileges || []
    : facilityPrivilegeSets.flatMap((set) => set.privileges);

  const categories = Array.from(new Set(facilityPrivilegeSets.map((set) => set.unit)));

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Wallet · Privilege Request</Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Request Privilege</h1>
          <p className="text-sm text-muted-foreground">
            Submit evidence and attestations to request hospital privileges
          </p>
        </div>
      </header>

      {/* Privilege Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Privilege</CardTitle>
          <CardDescription>Choose the procedure or category you want to request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Category</label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Privilege</label>
            <Select
              value={selectedPrivilege?.privilegeCode || ''}
              onValueChange={(code) => {
                const privilege = availablePrivileges.find((p) => p.privilegeCode === code);
                setSelectedPrivilege(privilege || null);
                // Initialize skill attestations
                if (privilege) {
                  setSkillAttestations(
                    privilege.requiredSkills.map((skill) => ({
                      skillName: skill,
                      attestedBy: '',
                      required: true,
                    }))
                  );
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select privilege" />
              </SelectTrigger>
              <SelectContent>
                {availablePrivileges.map((priv) => (
                  <SelectItem key={priv.privilegeCode} value={priv.privilegeCode}>
                    {priv.procedureName} ({priv.privilegeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPrivilege && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">{selectedPrivilege.procedureName}</p>
              <p className="text-xs text-muted-foreground">{selectedPrivilege.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{selectedPrivilege.specialty}</Badge>
                <Badge variant="outline">Risk: {selectedPrivilege.riskLevel}</Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence Submission */}
      {selectedPrivilege && (
        <Card>
          <CardHeader>
            <CardTitle>Required Evidence</CardTitle>
            <CardDescription>Upload documents and certificates</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPrivilege.requiredCredentials.map((cred) => (
              <div key={cred} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{cred}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleEvidenceUpload(`credential:${cred}`, file);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            ))}

            {selectedPrivilege.deaRequired && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">DEA Registration</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleEvidenceUpload('dea', file);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            )}

            {selectedPrivilege.mateRequired && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">MATE Registration</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf,.jpg,.jpeg,.png';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) {
                        handleEvidenceUpload('mate', file);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload
                </Button>
              </div>
            )}

            {evidence.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Uploaded Evidence</p>
                {evidence.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg border p-2">
                    <span className="text-sm">{item.type}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEvidence((prev) => prev.filter((_, i) => i !== idx));
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Skill Attestation */}
      {selectedPrivilege && selectedPrivilege.requiredSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Skill Attestations</CardTitle>
            <CardDescription>Supervisor verification required for each skill</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedPrivilege.requiredSkills.map((skill) => {
              const attestation = skillAttestations.find((a) => a.skillName === skill);
              return (
                <div key={skill} className="space-y-2">
                  <label className="text-sm font-medium">{skill}</label>
                  <Textarea
                    placeholder="Enter supervisor name and contact"
                    value={attestation?.attestedBy || ''}
                    onChange={(e) => handleSkillAttestation(skill, e.target.value)}
                  />
                  {attestation?.attestedBy && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Attestation provided</span>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Readiness Score */}
      {selectedPrivilege && (
        <Card>
          <CardHeader>
            <CardTitle>Privilege Readiness Score</CardTitle>
            <CardDescription>Your readiness to receive this privilege</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Readiness</span>
                <span className="font-semibold">{readinessScore}/100</span>
              </div>
              <Progress value={readinessScore} className="h-3" />
            </div>
            {readinessScore < 80 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertCircle className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Additional evidence required</p>
                  <p className="text-xs text-amber-700">
                    Complete all required evidence uploads and skill attestations to improve your readiness score.
                  </p>
                </div>
              </div>
            )}
            {readinessScore >= 80 && (
              <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                <CheckCircle2 className="h-4 w-4 mt-0.5" />
                <div>
                  <p className="font-medium">Ready to submit</p>
                  <p className="text-xs text-green-700">
                    Your request meets the minimum readiness threshold.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit Button */}
      {selectedPrivilege && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || readinessScore < 80}
          >
            {submitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      )}
    </div>
  );
}

