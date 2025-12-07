'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, RefreshCw, QrCode, Share2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';

interface LicensePassport {
  id: string;
  clinicianId: string;
  passport: {
    licenses: Array<{
      state: string;
      licenseNumber: string;
      status: string;
      expirationDate?: string;
      issueDate?: string;
    }>;
    compactMemberships?: string[];
    reciprocity?: Record<string, boolean>;
  };
  version: number;
  updatedAt: string;
}

interface PassportEligibility {
  eligible: boolean;
  reasons: string[];
  compactEligible: string[];
  reciprocityEligible: string[];
}

interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export default function LicensePassportPage() {
  const [passport, setPassport] = useState<LicensePassport | null>(null);
  const [eligibility, setEligibility] = useState<PassportEligibility | null>(null);
  const [anomalies, setAnomalies] = useState<{ anomalies: Anomaly[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const clinicianId = 'current-user-id'; // TODO: Get from auth context

  useEffect(() => {
    loadPassport();
  }, []);

  const loadPassport = async () => {
    try {
      setLoading(true);
      const [passportRes, eligibilityRes, anomaliesRes] = await Promise.all([
        fetch(`/api/passport/digitalLicense/${clinicianId}`),
        fetch(`/api/passport/digitalLicense/validate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicianId }),
        }),
        fetch(`/api/passport/digitalLicense/${clinicianId}/anomalies`),
      ]);

      if (passportRes.ok) {
        const data = await passportRes.json();
        setPassport(data);
      }

      if (eligibilityRes.ok) {
        const data = await eligibilityRes.json();
        setEligibility(data);
      }

      if (anomaliesRes.ok) {
        const data = await anomaliesRes.json();
        setAnomalies(data);
      }
    } catch (error) {
      console.error('Failed to load passport', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await fetch(`/api/passport/digitalLicense/${clinicianId}/refresh`, {
        method: 'POST',
      });
      await loadPassport();
    } catch (error) {
      console.error('Failed to refresh passport', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      const res = await fetch(`/api/passport/digitalLicense/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicianId }),
      });

      if (res.ok) {
        const { sdJwt } = await res.json();
        // Generate QR code from SD-JWT
        const shareUrl = `${window.location.origin}/verify/passport?token=${encodeURIComponent(sdJwt)}`;
        setQrCode(shareUrl);
      }
    } catch (error) {
      console.error('Failed to generate share link', error);
    } finally {
      setSharing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Digital License Passport</CardTitle>
            <CardDescription>No passport found. Building passport...</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Build Passport
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const severityColors = {
    low: 'bg-yellow-100 text-yellow-800',
    medium: 'bg-orange-100 text-orange-800',
    high: 'bg-red-100 text-red-800',
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Digital License Passport</h1>
          <p className="text-muted-foreground">Version {passport.version}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button onClick={handleShare} disabled={sharing}>
            {sharing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            Share
          </Button>
        </div>
      </div>

      {eligibility && (
        <Alert className={eligibility.eligible ? 'border-green-500' : 'border-red-500'}>
          {eligibility.eligible ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
          <AlertDescription>
            {eligibility.eligible ? (
              <span className="text-green-700">Passport is eligible for practice</span>
            ) : (
              <div>
                <span className="text-red-700">Passport has eligibility issues:</span>
                <ul className="list-disc list-inside mt-2">
                  {eligibility.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {anomalies && anomalies.anomalies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Anomalies Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalies.anomalies.map((anomaly, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Badge className={severityColors[anomaly.severity]}>{anomaly.severity}</Badge>
                  <span>{anomaly.description}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Licenses</CardTitle>
            <CardDescription>{passport.passport.licenses.length} license(s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {passport.passport.licenses.map((license, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">{license.state}</span>
                    <Badge variant={license.status === 'active' ? 'default' : 'secondary'}>
                      {license.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>License: {license.licenseNumber}</div>
                    {license.expirationDate && (
                      <div>
                        Expires: {new Date(license.expirationDate).toLocaleDateString()}
                      </div>
                    )}
                    {license.issueDate && (
                      <div>Issued: {new Date(license.issueDate).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compact Memberships</CardTitle>
            <CardDescription>
              {passport.passport.compactMemberships?.length ?? 0} compact(s)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {passport.passport.compactMemberships && passport.passport.compactMemberships.length > 0 ? (
              <div className="space-y-2">
                {passport.passport.compactMemberships.map((compact, i) => (
                  <Badge key={i} variant="outline">
                    {compact}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No compact memberships</p>
            )}
          </CardContent>
        </Card>
      </div>

      {qrCode && (
        <Card>
          <CardHeader>
            <CardTitle>Share Passport</CardTitle>
            <CardDescription>Scan QR code or share link</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="border rounded-lg p-4">
                <QrCode className="h-32 w-32" />
              </div>
              <p className="text-sm text-muted-foreground break-all">{qrCode}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

