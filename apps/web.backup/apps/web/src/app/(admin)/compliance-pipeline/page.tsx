'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, AlertTriangle, CheckCircle2, Download, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

interface CompliancePipeline {
  id: string;
  region: string;
  pipeline: Record<string, unknown>;
  updatedAt: string;
}

export default function CompliancePipelinePage() {
  const [pipelines, setPipelines] = useState<CompliancePipeline[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      // In production, fetch from API
      setPipelines([]);
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Global Compliance Pipeline</h1>
          <p className="text-muted-foreground mt-2">
            Adaptive rule engine that interprets worldwide credentialing & privileging regulations
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchPipelines} disabled={loading} variant="outline">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Active Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelines.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Compliance pipelines configured</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Rules Processed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Total compliance rules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Exceptions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground mt-1">Approved exceptions</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Regional Pipelines
          </CardTitle>
          <CardDescription>Compliance pipelines by region</CardDescription>
        </CardHeader>
        <CardContent>
          {pipelines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No compliance pipelines configured</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Region</TableHead>
                  <TableHead>Authority</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipelines.map((pipeline) => (
                  <TableRow key={pipeline.id}>
                    <TableCell>{pipeline.region}</TableCell>
                    <TableCell>
                      <Badge variant="outline">NCQA</Badge>
                    </TableCell>
                    <TableCell>{new Date(pipeline.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge variant="default">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








