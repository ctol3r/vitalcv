/**
 * B252C-I18N-022: TranslationAdmin Dashboard UI
 *
 * Admin overview of translation status: lists languages, number of keys translated,
 * untranslated keys; includes charts; supports filtering and search; responsive and accessible
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Globe,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  BarChart3,
  Languages,
} from 'lucide-react';

interface LanguageStatus {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  totalKeys: number;
  translatedKeys: number;
  untranslatedKeys: number;
  completionPercentage: number;
}

interface DashboardStats {
  totalLanguages: number;
  enabledLanguages: number;
  totalKeys: number;
  averageCompletion: number;
}

export default function TranslationAdminDashboard() {
  const router = useRouter();
  const [languages, setLanguages] = useState<LanguageStatus[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterEnabled, setFilterEnabled] = useState<boolean | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/i18n/dashboard');
      if (!response.ok) {
        throw new Error('Failed to fetch translation dashboard data');
      }
      const data = await response.json();
      setLanguages(data.languages || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredLanguages = languages.filter((lang) => {
    const matchesSearch =
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterEnabled === null || lang.enabled === filterEnabled;

    return matchesSearch && matchesFilter;
  });

  const getCompletionColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    if (percentage >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">Loading translation dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Translation Dashboard</h1>
        <p className="text-gray-600">
          Overview of translation status across all languages
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Languages</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalLanguages}</div>
              <p className="text-xs text-muted-foreground">
                {stats.enabledLanguages} enabled
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
              <Languages className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalKeys}</div>
              <p className="text-xs text-muted-foreground">Translation keys</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Average Completion
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.averageCompletion.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">Across all languages</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enabled Languages</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.enabledLanguages}</div>
              <p className="text-xs text-muted-foreground">Active in system</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter languages by status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search languages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                aria-label="Search languages"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterEnabled === null ? 'default' : 'outline'}
                onClick={() => setFilterEnabled(null)}
                size="sm"
              >
                All
              </Button>
              <Button
                variant={filterEnabled === true ? 'default' : 'outline'}
                onClick={() => setFilterEnabled(true)}
                size="sm"
              >
                Enabled
              </Button>
              <Button
                variant={filterEnabled === false ? 'default' : 'outline'}
                onClick={() => setFilterEnabled(false)}
                size="sm"
              >
                Disabled
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Languages Table */}
      <Card>
        <CardHeader>
          <CardTitle>Language Status</CardTitle>
          <CardDescription>
            Translation completion status for each language
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Language</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Translated</TableHead>
                <TableHead>Untranslated</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLanguages.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No languages found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLanguages.map((lang) => (
                  <TableRow key={lang.id}>
                    <TableCell>
                      <div className="font-medium">{lang.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {lang.nativeName}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{lang.code}</Badge>
                    </TableCell>
                    <TableCell>
                      {lang.enabled ? (
                        <Badge variant="default" className="bg-green-500">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-green-600">
                        {lang.translatedKeys}
                      </span>
                      <span className="text-muted-foreground"> / {lang.totalKeys}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-red-600">
                        {lang.untranslatedKeys}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${getCompletionColor(
                              lang.completionPercentage
                            )}`}
                            style={{ width: `${lang.completionPercentage}%` }}
                            role="progressbar"
                            aria-valuenow={lang.completionPercentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`${lang.name} completion: ${lang.completionPercentage}%`}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {lang.completionPercentage.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/admin/i18n/edit/${lang.code}`)}
                        aria-label={`Edit translations for ${lang.name}`}
                      >
                        Edit
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

