'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, FileText, AlertTriangle, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function ComplianceOSPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [healthScore, setHealthScore] = useState<number | null>(null);
  const [region] = useState('US');

  useEffect(() => {
    loadComplianceData();
  }, [region]);

  async function loadComplianceData() {
    try {
      setLoading(true);

      const [rulesRes, healthRes] = await Promise.all([
        fetch(`${API_BASE}/api/compliance-os/${region}/rules`),
        fetch(`${API_BASE}/api/compliance-os/${region}/health-score`),
      ]);

      const rulesData = await rulesRes.json();
      const healthData = await healthRes.json();

      if (rulesData.success) {
        setRules(rulesData.rules?.rules || []);
      }
      if (healthData.success) {
        setHealthScore(healthData.score);
      }
    } catch (error) {
      console.error('Failed to load compliance data:', error);
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
        <h1 className="text-3xl font-bold">Compliance Intelligence Operating System</h1>
        <p className="text-muted-foreground mt-2">
          A governing engine that enforces all compliance logic across workflows, users, roles, and systems
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Compliance Health Score
            </CardTitle>
            <CardDescription>System-wide compliance (0-100)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{healthScore?.toFixed(1) || '0'}/100</div>
            <p className="text-sm text-muted-foreground mt-2">
              {healthScore && healthScore > 80 ? 'Excellent' : healthScore && healthScore > 60 ? 'Good' : 'Needs improvement'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Active Frameworks
            </CardTitle>
            <CardDescription>Compiled compliance rules</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.length}</div>
            <p className="text-sm text-muted-foreground mt-2">Frameworks active</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compliance Frameworks</CardTitle>
          <CardDescription>NCQA, JC, DEA/MATE, FSMB, CMS, TEFCA</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {rules.map((rule: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-3">
                  {rule.active ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <p className="font-medium">{rule.framework}</p>
                    <p className="text-sm text-muted-foreground">{rule.name}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {rule.rules?.slice(0, 2).map((r: string, j: number) => (
                    <Badge key={j} variant="secondary">{r}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

