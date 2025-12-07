'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, Shield, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export default function CodexPage() {
  const [loading, setLoading] = useState(true);
  const [codex, setCodex] = useState<any>(null);
  const clinicianId = 'default'; // Would come from auth context

  useEffect(() => {
    loadCodex();
  }, []);

  async function loadCodex() {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/evidence-codex/${clinicianId}`);
      if (res.ok) {
        const data = await res.json();
        setCodex(data.codex);
      }
    } catch (error) {
      console.error('Failed to load codex:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && !codex) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const categories = codex?.categories || {};
  const integrity = codex?.integrity || { score: 0, gaps: [], conflicts: [] };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Evidence Codex</h1>
          <p className="text-muted-foreground mt-2">
            Unified evidence codex linking all documents, VCs, proofs & anchors
          </p>
        </div>
        <Button variant="outline" onClick={loadCodex}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Integrity Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{integrity.score || 0}%</div>
            <div className="text-sm text-muted-foreground mt-2">Evidence quality</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Identity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.identity?.length || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">Documents</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Licensure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.licensure?.length || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">Active licenses</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Training</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{categories.training?.length || 0}</div>
            <div className="text-sm text-muted-foreground mt-2">Records</div>
          </CardContent>
        </Card>
      </div>

      {codex?.summary && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{codex.summary}</p>
          </CardContent>
        </Card>
      )}

      {integrity.gaps && integrity.gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evidence Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {integrity.gaps.map((gap: string, idx: number) => (
                <li key={idx} className="flex items-center text-yellow-600">
                  <AlertCircle className="h-4 w-4 mr-2" />
                  {gap}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}








