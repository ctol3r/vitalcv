'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Shield, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface HardeningStatus {
  id: string;
  did: string;
  level: 'basic' | 'hardened' | 'enterprise' | 'regulator';
  metadata: Record<string, unknown>;
  updatedAt: string;
}

interface ValidationResult {
  valid: boolean;
  issues: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}

interface TimelineEvent {
  timestamp: string;
  type: string;
  details: Record<string, unknown>;
}

export default function IdentityHardeningPage() {
  const [did, setDid] = useState('');
  const [hardening, setHardening] = useState<HardeningStatus | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [timeline, setTimeline] = useState<{ events: TimelineEvent[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  const levelColors = {
    basic: 'bg-gray-100 text-gray-800',
    hardened: 'bg-blue-100 text-blue-800',
    enterprise: 'bg-purple-100 text-purple-800',
    regulator: 'bg-red-100 text-red-800',
  };

  const severityColors = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-orange-100 text-orange-800',
    high: 'bg-red-100 text-red-800',
  };

  const handleSearch = async () => {
    if (!did) return;

    try {
      setLoading(true);
      const [hardeningRes, validationRes, timelineRes] = await Promise.all([
        fetch(`/api/identity/hardening/${did}`),
        fetch(`/api/identity/hardening/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ did }),
        }),
        fetch(`/api/identity/hardening/${did}/timeline`),
      ]);

      if (hardeningRes.ok) {
        const data = await hardeningRes.json();
        setHardening(data);
      } else {
        setHardening(null);
      }

      if (validationRes.ok) {
        const data = await validationRes.json();
        setValidation(data);
      }

      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data);
      }
    } catch (error) {
      console.error('Failed to load hardening status', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    if (!did) return;

    try {
      setValidating(true);
      const res = await fetch(`/api/identity/hardening/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did }),
      });

      if (res.ok) {
        const data = await res.json();
        setValidation(data);
      }
    } catch (error) {
      console.error('Failed to validate', error);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Identity Hardening</h1>
          <p className="text-muted-foreground">DID security and trust levels</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search DID</CardTitle>
          <CardDescription>Enter a DID to view hardening status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor="did">DID</Label>
              <Input
                id="did"
                value={did}
                onChange={(e) => setDid(e.target.value)}
                placeholder="did:key:..."
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleSearch} disabled={loading || !did}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {hardening && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Hardening Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">DID:</span>
                <code className="text-sm">{hardening.did}</code>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Level:</span>
                <Badge className={levelColors[hardening.level]}>{hardening.level}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold">Last Updated:</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(hardening.updatedAt).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {validation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {validation.valid ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              Validation Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validation.issues.length > 0 ? (
                validation.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <Badge className={severityColors[issue.severity]}>{issue.severity}</Badge>
                    <div>
                      <div className="font-semibold">{issue.type}</div>
                      <div className="text-sm text-muted-foreground">{issue.description}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-green-600">No issues found</div>
              )}
            </div>
            <div className="mt-4">
              <Button onClick={handleValidate} disabled={validating} variant="outline">
                {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Re-validate
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {timeline && timeline.events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Audit Timeline
            </CardTitle>
            <CardDescription>History of DID changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeline.events.map((event, i) => (
                <div key={i} className="border-l-2 pl-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{event.type}</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {event.details.eventType && (
                      <div>Event: {event.details.eventType}</div>
                    )}
                    {event.details.anchorTxHash && (
                      <div className="font-mono text-xs">
                        Anchor: {String(event.details.anchorTxHash).substring(0, 16)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

