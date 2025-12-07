'use client';

import { Shield, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface EmployerSummaryProps {
  verified: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  summary: {
    credentialType: string;
    issuer: string;
    issuedAt: string;
    expiresAt?: string;
  };
}

export function EmployerSummary({ verified, riskLevel, summary }: EmployerSummaryProps) {
  const getRiskColor = () => {
    switch (riskLevel) {
      case 'low':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
    }
  };

  const getRiskBadge = () => {
    switch (riskLevel) {
      case 'low':
        return <Badge variant="default">Low Risk</Badge>;
      case 'medium':
        return <Badge variant="secondary">Medium Risk</Badge>;
      case 'high':
        return <Badge variant="destructive">High Risk</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Verification Summary</span>
          {verified ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Status</span>
          <Badge variant={verified ? 'default' : 'destructive'}>
            {verified ? 'Verified' : 'Not Verified'}
          </Badge>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Risk Level</span>
          {getRiskBadge()}
        </div>

        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Credential Type</span>
            <span className="font-medium">{summary.credentialType}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Issuer</span>
            <span className="font-medium">{summary.issuer}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Issued</span>
            <span className="font-medium">{new Date(summary.issuedAt).toLocaleDateString()}</span>
          </div>
          {summary.expiresAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Expires</span>
              <span className="font-medium">{new Date(summary.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}








