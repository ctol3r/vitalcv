/**
 * B230C-INTL-013: LocalizationCoverage Dashboard
 *
 * Shows translation coverage across locales: strings translated vs missing,
 * last updated, QA status; includes import/export buttons for translation files.
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  Upload,
  Loader2,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

interface LocaleCoverage {
  locale: string;
  localeName: string;
  totalStrings: number;
  translatedStrings: number;
  missingStrings: number;
  coveragePercent: number;
  lastUpdated: string | null;
  lastUpdatedBy: string | null;
  qaStatus: 'pending' | 'in_progress' | 'approved' | 'needs_review';
  qaNotes: string | null;
}

interface TranslationStats {
  totalLocales: number;
  totalStrings: number;
  averageCoverage: number;
  localesNeedingAttention: number;
}

export default function LocalizationCoveragePage() {
  const [locales, setLocales] = useState<LocaleCoverage[]>([]);
  const [stats, setStats] = useState<TranslationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCoverage();
  }, []);

  async function loadCoverage() {
    try {
      setLoading(true);
      const res = await fetch('/api/demo/system/localisation/coverage');
      if (!res.ok) throw new Error('Failed to load coverage data');
      const data = await res.json();
      setLocales(data.locales || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  }

  async function refreshCoverage() {
    try {
      setRefreshing(true);
      await loadCoverage();
    } finally {
      setRefreshing(false);
    }
  }

  async function exportTranslations(locale?: string) {
    try {
      const url = locale
        ? `/api/demo/system/localisation/export?locale=${locale}`
        : '/api/demo/system/localisation/export';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to export translations');

      const blob = await res.blob();
      const filename = locale
        ? `translations-${locale}.json`
        : `translations-all-${new Date().toISOString().split('T')[0]}.json`;

      const url2 = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url2;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url2);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const translations = JSON.parse(content);

        const res = await fetch('/api/demo/system/localisation/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ translations }),
        });

        if (!res.ok) throw new Error('Failed to import translations');
        await loadCoverage();
        alert('Translations imported successfully');
      } catch (err) {
        alert(`Failed to import: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  }

  function getQaStatusBadge(status: string) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">Approved</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      case 'needs_review':
        return <Badge className="bg-yellow-500">Needs Review</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  }

  function getCoverageColor(percent: number) {
    if (percent >= 90) return 'text-green-600';
    if (percent >= 70) return 'text-yellow-600';
    return 'text-red-600';
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Localization Coverage</h1>
          <p className="text-muted-foreground">
            Monitor translation coverage across all locales and manage translation files.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refreshCoverage} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={() => exportTranslations()}>
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <label>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" asChild>
              <span>
                <Upload className="mr-2 h-4 w-4" />
                Import
              </span>
            </Button>
          </label>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Locales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLocales}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Strings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalStrings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Coverage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageCoverage.toFixed(1)}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Need Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {stats.localesNeedingAttention}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Locale Coverage Details</CardTitle>
          <CardDescription>
            Translation coverage and QA status for each locale
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Locale</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Translated</TableHead>
                <TableHead>Missing</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>QA Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No locale data available
                  </TableCell>
                </TableRow>
              ) : (
                locales.map((locale) => (
                  <TableRow key={locale.locale}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        <span className="font-medium">{locale.localeName}</span>
                        <Badge variant="outline">{locale.locale}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className={getCoverageColor(locale.coveragePercent)}>
                            {locale.coveragePercent.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={locale.coveragePercent} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600 font-medium">
                        {locale.translatedStrings.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {locale.missingStrings > 0 ? (
                        <span className="text-red-600 font-medium">
                          {locale.missingStrings.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {locale.lastUpdated ? (
                        <div className="text-sm">
                          <div>{new Date(locale.lastUpdated).toLocaleDateString()}</div>
                          {locale.lastUpdatedBy && (
                            <div className="text-muted-foreground text-xs">
                              by {locale.lastUpdatedBy}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>{getQaStatusBadge(locale.qaStatus)}</TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportTranslations(locale.locale)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

