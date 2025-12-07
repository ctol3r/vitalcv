'use client';

import { useEffect, useState } from 'react';
import { Globe, FileText, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function IntlHiringPage() {
  const [clinicianId, setClinicianId] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [hiringCase, setHiringCase] = useState<any>(null);
  const [visaRequirements, setVisaRequirements] = useState<any>(null);
  const [readinessScore, setReadinessScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateCase = async () => {
    if (!clinicianId || !targetCountry) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/intl-hiring/case`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicianId,
          targetCountry,
          credentials: [], // Would be populated from actual data
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setHiringCase(data);
        fetchVisaRequirements();
      }
    } catch (error) {
      console.error('Failed to create hiring case', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchVisaRequirements = async () => {
    if (!targetCountry) return;
    try {
      const res = await fetch(`${API_BASE}/api/intl-hiring/visa-requirements/${targetCountry}`);
      if (res.ok) {
        const data = await res.json();
        setVisaRequirements(data);
      }
    } catch (error) {
      console.error('Failed to fetch visa requirements', error);
    }
  };

  const handleDownloadOnboardingPack = async () => {
    if (!hiringCase) return;
    try {
      const res = await fetch(`${API_BASE}/api/intl-hiring/case/${hiringCase.id}/onboarding-pack`);
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `onboarding-${hiringCase.id}.pdf`;
        a.click();
      }
    } catch (error) {
      console.error('Failed to download onboarding pack', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">International Hiring Gateway</h1>
        <p className="text-muted-foreground mt-2">
          End-to-end international recruitment: credentials, visas, equivalencies, onboarding
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Hiring Case</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="clinicianId">Clinician ID</Label>
            <Input
              id="clinicianId"
              value={clinicianId}
              onChange={(e) => setClinicianId(e.target.value)}
              placeholder="Enter clinician ID"
            />
          </div>
          <div>
            <Label htmlFor="targetCountry">Target Country</Label>
            <Input
              id="targetCountry"
              value={targetCountry}
              onChange={(e) => {
                setTargetCountry(e.target.value);
                fetchVisaRequirements();
              }}
              placeholder="US, UK, AU, etc."
            />
          </div>
          <Button onClick={handleCreateCase} disabled={loading}>
            Create Case
          </Button>
        </CardContent>
      </Card>

      {visaRequirements && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Visa Requirements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <span className="font-medium">Visa Type: </span>
                {visaRequirements.visaType}
              </div>
              <div>
                <span className="font-medium">Estimated Days: </span>
                {visaRequirements.estimatedDays}
              </div>
              <div>
                <span className="font-medium">Requirements:</span>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  {visaRequirements.requirements?.map((req: string, idx: number) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium">Documents:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {visaRequirements.documents?.map((doc: string, idx: number) => (
                    <Badge key={idx} variant="outline">
                      {doc}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hiringCase && (
        <Card>
          <CardHeader>
            <CardTitle>Hiring Case Status</CardTitle>
            <CardDescription>Case ID: {hiringCase.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <span className="font-medium">Status: </span>
                <Badge
                  variant={
                    hiringCase.status === 'completed'
                      ? 'default'
                      : hiringCase.status === 'in-progress'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {hiringCase.status}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Steps:</span>
                <div className="space-y-2 mt-2">
                  {(hiringCase.steps || []).map((step: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{step.name}</div>
                        {step.estimatedDays && (
                          <div className="text-sm text-muted-foreground">
                            Estimated: {step.estimatedDays} days
                          </div>
                        )}
                      </div>
                      <Badge
                        variant={
                          step.status === 'completed'
                            ? 'default'
                            : step.status === 'in-progress'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {step.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDownloadOnboardingPack} variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Download Onboarding Pack
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

