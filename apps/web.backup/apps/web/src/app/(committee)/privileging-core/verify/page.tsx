/**
 * Facility Privileging Engine - Verifier View
 * Phase 3: Verifier-mode view (approve/deny/request evidence)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
import { Textarea } from '@/components/ui/textarea';
import type { PrivilegeRequest } from '@/lib/privileging/models';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:4000';

export default function PrivilegeVerifierPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<PrivilegeRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PrivilegeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    loadPendingRequests();
  }, []);

  async function loadPendingRequests() {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/facility/privileges/requests?status=pending`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleReview(action: 'approve' | 'deny' | 'request_evidence') {
    if (!selectedRequest) return;

    setReviewing(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/facility/privileges/request/${selectedRequest.id}/review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            comment: reviewComment,
          }),
        }
      );

      if (response.ok) {
        await loadPendingRequests();
        setSelectedRequest(null);
        setReviewComment('');
      } else {
        const error = await response.json();
        alert(`Failed to review: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to review:', error);
      alert('Failed to review request');
    } finally {
      setReviewing(false);
    }
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Committee · Privilege Verification</Badge>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Privilege Verification</h1>
          <p className="text-sm text-muted-foreground">
            Review and approve privilege requests from clinicians
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
        {/* Pending Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Requests</CardTitle>
            <CardDescription>
              {pendingCount} request{pendingCount !== 1 ? 's' : ''} awaiting review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending requests</p>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => setSelectedRequest(request)}
                  className={`w-full rounded-lg border p-3 text-left transition hover:bg-muted/40 ${
                    selectedRequest?.id === request.id ? 'bg-primary/5 border-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{request.privilegeCode}</p>
                      <p className="text-xs text-muted-foreground">
                        Clinician: {request.clinicianId.slice(0, 8)}...
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        request.readinessScore >= 80
                          ? 'default'
                          : request.readinessScore >= 60
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      {request.readinessScore}%
                    </Badge>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Request Detail */}
        {selectedRequest ? (
          <Card>
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
              <CardDescription>Review evidence and make a decision</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Request Info */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Privilege Code</span>
                  <Badge variant="outline">{selectedRequest.privilegeCode}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Clinician ID</span>
                  <span className="text-sm font-mono">{selectedRequest.clinicianId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Requested At</span>
                  <span className="text-sm">
                    {new Date(selectedRequest.requestedAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Readiness Score</span>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedRequest.readinessScore} className="w-24 h-2" />
                    <span className="text-sm font-semibold">{selectedRequest.readinessScore}%</span>
                  </div>
                </div>
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Submitted Evidence</p>
                {selectedRequest.evidence.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No evidence submitted</p>
                ) : (
                  <div className="space-y-2">
                    {selectedRequest.evidence.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.type}</span>
                          {item.verified && (
                            <Badge variant="outline" className="text-xs">
                              Verified
                            </Badge>
                          )}
                        </div>
                        {item.url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={item.url} target="_blank" rel="noreferrer">
                              View
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Skill Attestations */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Skill Attestations</p>
                {selectedRequest.skillAttestations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attestations provided</p>
                ) : (
                  <div className="space-y-2">
                    {selectedRequest.skillAttestations.map((attestation, idx) => (
                      <div key={idx} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{attestation.skillName}</span>
                          {attestation.attestedBy ? (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Attested by {attestation.attestedBy}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="mr-1 h-3 w-3" />
                              Missing
                            </Badge>
                          )}
                        </div>
                        {attestation.attestedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Attested at {new Date(attestation.attestedAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Review Comment */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Review Comment</label>
                <Textarea
                  placeholder="Add comments about your decision..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                />
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  onClick={() => handleReview('approve')}
                  disabled={reviewing}
                  className="flex-1"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleReview('request_evidence')}
                  disabled={reviewing}
                  className="flex-1"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Request Evidence
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleReview('deny')}
                  disabled={reviewing}
                  className="flex-1"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Deny
                </Button>
              </div>

              {selectedRequest.conditions && selectedRequest.conditions.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-900">Conditions</p>
                  <ul className="mt-1 space-y-1 text-sm text-amber-700">
                    {selectedRequest.conditions.map((condition, idx) => (
                      <li key={idx}>• {condition}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                Select a request to review
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

