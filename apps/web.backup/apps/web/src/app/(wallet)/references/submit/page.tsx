/**
 * Reference Submission Page
 * Web-based form for employers to submit references via secure link
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ReferenceRequest {
  id: string;
  clinicianId: string;
  employerEmail: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  expiresAt: string;
}

export default function ReferenceSubmissionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [request, setRequest] = useState<ReferenceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state
  const [employerName, setEmployerName] = useState('');
  const [employerRole, setEmployerRole] = useState('');
  const [employerOrganization, setEmployerOrganization] = useState('');
  const [employmentStartDate, setEmploymentStartDate] = useState('');
  const [employmentEndDate, setEmploymentEndDate] = useState('');
  const [roleResponsibilities, setRoleResponsibilities] = useState<string[]>([]);
  const [behaviorRating, setBehaviorRating] = useState<Record<string, number>>({});
  const [strengths, setStrengths] = useState('');
  const [areasToGrow, setAreasToGrow] = useState('');
  const [issuerDid, setIssuerDid] = useState('');
  const [consent, setConsent] = useState(false);

  const responsibilityOptions = [
    'Patient care',
    'Team leadership',
    'Clinical documentation',
    'Quality improvement',
    'Training & mentoring',
    'Research & publications',
  ];

  const behaviorCategories = [
    { key: 'professionalism', label: 'Professionalism' },
    { key: 'communication', label: 'Communication' },
    { key: 'reliability', label: 'Reliability' },
    { key: 'collaboration', label: 'Collaboration' },
    { key: 'problem_solving', label: 'Problem Solving' },
  ];

  useEffect(() => {
    if (!token) {
      setError('Invalid reference request link');
      setLoading(false);
      return;
    }

    // Fetch reference request details
    const fetchRequest = async () => {
      try {
        const response = await fetch(`/api/references/request/${token}`);
        if (!response.ok) {
          const data = await response.json();
          if (data.expired) {
            setError('This reference request has expired. Please contact the clinician for a new request.');
          } else {
            setError(data.error || 'Failed to load reference request');
          }
          setLoading(false);
          return;
        }

        const data = await response.json();
        setRequest(data);
        setEmployerOrganization(data.employerEmail.split('@')[1] || '');
      } catch (err: any) {
        setError(err.message || 'Failed to load reference request');
      } finally {
        setLoading(false);
      }
    };

    fetchRequest();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setError('Please provide consent to submit this reference');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/references/submit?token=${token}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employerName,
          employerRole,
          employerOrganization,
          employerEmail: request?.employerEmail,
          employmentStartDate,
          employmentEndDate,
          roleResponsibilities,
          behaviorRating,
          strengths,
          areasToGrow,
          issuerDid: issuerDid || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit reference');
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to submit reference');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Skeleton className="h-10 w-64 mb-6" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error && !request) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (success) {
    return (
      <div className="container mx-auto max-w-3xl py-12 px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Reference Submitted Successfully
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Thank you for providing this reference. The clinician has been notified.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Submit Reference</CardTitle>
          <CardDescription>
            Please provide a reference for the clinician. All fields are optional, but more detail helps build trust.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              <div>
                <Label htmlFor="employerName">Your Name *</Label>
                <Input
                  id="employerName"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="employerRole">Your Role</Label>
                <Input
                  id="employerRole"
                  value={employerRole}
                  onChange={(e) => setEmployerRole(e.target.value)}
                  placeholder="e.g., Medical Director, Supervisor"
                />
              </div>

              <div>
                <Label htmlFor="employerOrganization">Organization *</Label>
                <Input
                  id="employerOrganization"
                  value={employerOrganization}
                  onChange={(e) => setEmployerOrganization(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Employment Start Date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={employmentStartDate}
                    onChange={(e) => setEmploymentStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Employment End Date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={employmentEndDate}
                    onChange={(e) => setEmploymentEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Role Responsibilities</Label>
              <div className="grid grid-cols-2 gap-2">
                {responsibilityOptions.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      id={`resp-${option}`}
                      checked={roleResponsibilities.includes(option)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setRoleResponsibilities([...roleResponsibilities, option]);
                        } else {
                          setRoleResponsibilities(roleResponsibilities.filter((r) => r !== option));
                        }
                      }}
                    />
                    <label
                      htmlFor={`resp-${option}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Behavior & Professionalism Ratings</Label>
              {behaviorCategories.map((category) => (
                <div key={category.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{category.label}</Label>
                    <Badge variant="outline">
                      {behaviorRating[category.key] || 'Not rated'}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <Button
                        key={rating}
                        type="button"
                        variant={behaviorRating[category.key] === rating ? 'default' : 'outline'}
                        size="sm"
                        onClick={() =>
                          setBehaviorRating({
                            ...behaviorRating,
                            [category.key]: rating,
                          })
                        }
                      >
                        {rating}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="strengths">Strengths</Label>
              <Textarea
                id="strengths"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="What are this clinician's key strengths?"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="areasToGrow">Areas to Grow</Label>
              <Textarea
                id="areasToGrow"
                value={areasToGrow}
                onChange={(e) => setAreasToGrow(e.target.value)}
                placeholder="What areas could this clinician focus on for growth?"
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="issuerDid">Your DID (Optional - for verified endorsement)</Label>
              <Input
                id="issuerDid"
                value={issuerDid}
                onChange={(e) => setIssuerDid(e.target.value)}
                placeholder="did:key:..."
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="consent"
                checked={consent}
                onCheckedChange={(checked) => setConsent(checked === true)}
              />
              <label
                htmlFor="consent"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                I consent to this reference being shared with the clinician and potential employers *
              </label>
            </div>

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Reference'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

