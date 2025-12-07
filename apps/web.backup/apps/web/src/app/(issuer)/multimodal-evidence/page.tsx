'use client';

import { useEffect, useState } from 'react';
import { RefreshCcw, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface MultimodalEvidenceData {
  sources: Array<{
    type: string;
    source: string;
    timestamp: string;
    confidence: number;
  }>;
  consistency: {
    consistent: boolean;
    inconsistencies: Array<{
      field: string;
      sources: string[];
      values: any[];
    }>;
    score: number;
  };
  authenticity: {
    suspicious: boolean;
    flags: Array<{
      source: string;
      reason: string;
      score: number;
    }>;
  };
}

export default function MultimodalEvidencePage() {
  const [data, setData] = useState<MultimodalEvidenceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicianId] = useState('demo_clinician_123');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/multimodal-evidence/${clinicianId}`);
      if (res.ok) {
        const chain = await res.json();
        setData(chain);
      }
    } catch (error) {
      console.error('Failed to load multimodal evidence:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="space-y-2">
        <Badge variant="secondary">Issuer · Multimodal Evidence</Badge>
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Multimodal Evidence Chain</h1>
            <p className="text-muted-foreground">
              Ingest, map, align & verify evidence across images, PDFs, text, EHR, APIs & chain
            </p>
          </div>
          <Button
            variant="outline"
            className="ml-auto gap-2"
            onClick={loadData}
            disabled={loading}
          >
            <RefreshCcw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </header>

      {data && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Consistency Score</CardTitle>
                <CardDescription>Evidence consistency across formats</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-semibold">{data.consistency.score}%</span>
                    {data.consistency.consistent ? (
                      <Badge variant="default" className="gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Consistent
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Inconsistent
                      </Badge>
                    )}
                  </div>
                  {data.consistency.inconsistencies.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold">Inconsistencies:</div>
                      {data.consistency.inconsistencies.map((inc, idx) => (
                        <div key={idx} className="rounded-lg border p-2 text-sm">
                          <div className="font-semibold">{inc.field}</div>
                          <div className="text-muted-foreground">
                            Sources: {inc.sources.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Authenticity</CardTitle>
                <CardDescription>Document authenticity assessment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.authenticity.suspicious ? (
                    <Badge variant="destructive" className="gap-1">
                      <XCircle className="h-3 w-3" />
                      Suspicious
                    </Badge>
                  ) : (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Authentic
                    </Badge>
                  )}
                  {data.authenticity.flags.length > 0 && (
                    <div className="space-y-2">
                      {data.authenticity.flags.map((flag, idx) => (
                        <div key={idx} className="rounded-lg border border-destructive/20 bg-destructive/5 p-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-semibold">{flag.source}</span>
                            <Badge variant="destructive">{flag.score}%</Badge>
                          </div>
                          <div className="text-xs text-muted-foreground">{flag.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Evidence Sources</CardTitle>
              <CardDescription>All ingested evidence sources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data.sources.map((source, idx) => (
                  <div key={idx} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold capitalize">{source.type}</span>
                        <Badge variant="outline">{source.source}</Badge>
                        <Badge variant={source.confidence > 0.8 ? 'default' : 'secondary'}>
                          {Math.round(source.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(source.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12">
          <RefreshCcw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

