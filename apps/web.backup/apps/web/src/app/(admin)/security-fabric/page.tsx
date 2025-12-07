'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function SecurityFabricPage() {
  const [loading, setLoading] = useState(true);
  const [validatorIntegrity, setValidatorIntegrity] = useState<any>(null);
  const [auditIntegrity, setAuditIntegrity] = useState<any>(null);
  const [consensusLatency, setConsensusLatency] = useState<any>(null);
  const [interNodeTrust, setInterNodeTrust] = useState<any>(null);

  useEffect(() => {
    loadSecurityData();
  }, []);

  async function loadSecurityData() {
    try {
      setLoading(true);

      const [validatorRes, auditRes, latencyRes, trustRes] = await Promise.all([
        fetch(`${API_BASE}/api/security-fabric/validator-integrity`),
        fetch(`${API_BASE}/api/security-fabric/audit-integrity`),
        fetch(`${API_BASE}/api/security-fabric/consensus-latency`),
        fetch(`${API_BASE}/api/security-fabric/inter-node-trust`),
      ]);

      const validatorData = await validatorRes.json();
      const auditData = await auditRes.json();
      const latencyData = await latencyRes.json();
      const trustData = await trustRes.json();

      if (validatorData.success) {
        setValidatorIntegrity(validatorData.integrity);
      }
      if (auditData.success) {
        setAuditIntegrity(auditData.integrity);
      }
      if (latencyData.success) {
        setConsensusLatency(latencyData.latency);
      }
      if (trustData.success) {
        setInterNodeTrust(trustData.trust);
      }
    } catch (error) {
      console.error('Failed to load security data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Chain Hardened Security Fabric</h1>
        <p className="text-muted-foreground mt-2">
          Advanced, multi-layer blockchain security: consensus health, anomaly detection, validator integrity
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Validator Integrity
            </CardTitle>
            <CardDescription>Validator integrity detector</CardDescription>
          </CardHeader>
          <CardContent>
            {validatorIntegrity && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {(validatorIntegrity.overallIntegrity * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {validatorIntegrity.validators?.length || 0} validators
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Audit Integrity
            </CardTitle>
            <CardDescription>Audit-anchoring integrity checker</CardDescription>
          </CardHeader>
          <CardContent>
            {auditIntegrity && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {(auditIntegrity.integrity * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {auditIntegrity.mismatches?.length || 0} mismatches
                </p>
                {auditIntegrity.requiresReanchor && (
                  <Badge variant="destructive">Re-anchor required</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Consensus Latency
            </CardTitle>
            <CardDescription>Consensus-latency predictor</CardDescription>
          </CardHeader>
          <CardContent>
            {consensusLatency && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {consensusLatency.predictedLatency?.toFixed(0) || 0}ms
                </div>
                <p className="text-sm text-muted-foreground">Predicted latency</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Inter-Node Trust
            </CardTitle>
            <CardDescription>Inter-node trust evaluator</CardDescription>
          </CardHeader>
          <CardContent>
            {interNodeTrust && (
              <div className="space-y-2">
                <div className="text-2xl font-bold">
                  {(interNodeTrust.averageTrust * 100).toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground">
                  {interNodeTrust.nodes?.length || 0} nodes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {validatorIntegrity && validatorIntegrity.validators && (
        <Card>
          <CardHeader>
            <CardTitle>Validators</CardTitle>
            <CardDescription>Validator integrity status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validatorIntegrity.validators.slice(0, 5).map((validator: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{validator.validatorId}</p>
                    <p className="text-sm text-muted-foreground">Status: {validator.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={validator.integrityScore > 0.8 ? 'default' : 'secondary'}>
                      {(validator.integrityScore * 100).toFixed(0)}%
                    </Badge>
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

