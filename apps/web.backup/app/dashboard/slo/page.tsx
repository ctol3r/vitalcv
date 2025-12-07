'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

interface SLOMetrics {
  psvSuccess: number;
  psvFail: number;
  evidenceCompleteRatio: number;
  ttpDaysP50: number | null;
  minutesInNotes?: number;
  timestamp: string;
}

interface EvidenceData {
  id: string;
  doi: string;
  title: string;
  journal: string | null;
  authors: string[];
  metadata?: {
    tags?: string[];
    studyType?: string;
    category?: string;
    kpiReference?: string;
    srLabel?: string; // Systematic Review label
    publishedYear?: string;
  };
}

/**
 * B117C-FE-031: KPI Tile component with citation tooltip and trendline
 *
 * Features:
 * - Citation tooltip cites peer-reviewed study
 * - SR (Systematic Review) labels displayed
 * - Trendline with filter support (7d, 30d, 90d, all)
 */
function Tile({
  label,
  value,
  evidenceId,
  trend,
  trendlineData,
  trendlineFilter
}: {
  label: string;
  value: any;
  evidenceId?: string;
  trend?: 'up' | 'down' | 'stable';
  trendlineData?: Array<{ date: string; value: number }>;
  trendlineFilter?: '7d' | '30d' | '90d' | 'all';
}) {
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);

  useEffect(() => {
    if (evidenceId) {
      // Fetch evidence data for tooltip
      fetch(`/api/evidence/registry/${evidenceId}`)
        .then(res => res.json())
        .then(data => setEvidence(data))
        .catch(() => {});
    }
  }, [evidenceId]);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400';
  const lineColor = trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6b7280';

  // Filter trendline data based on trendlineFilter
  const getFilteredData = (data: Array<{ date: string; value: number }>, filter?: '7d' | '30d' | '90d' | 'all') => {
    if (!filter || filter === 'all') return data;
    const filterMap = { '7d': 7, '30d': 30, '90d': 90 };
    const count = filterMap[filter];
    return data.slice(-count);
  };

  // Generate mock trendline data if not provided
  const baseData = trendlineData || (trend ? Array.from({ length: 7 }, (_, i) => ({
    date: `D${i + 1}`,
    value: trend === 'down' ? 15 - i * 0.5 : trend === 'up' ? 10 + i * 0.5 : 12.5
  })) : []);

  const chartData = getFilteredData(baseData, trendlineFilter);

  return (
    <div className="rounded-2xl p-6 shadow bg-white relative" role="region" aria-label={`KPI tile: ${label}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600" id={`tile-label-${label.replace(/\s+/g, '-').toLowerCase()}`}>
          {label}
        </div>
        {trend && (
          <TrendIcon
            className={`h-4 w-4 ${trendColor}`}
            aria-label={`Trend: ${trend === 'up' ? 'increasing' : trend === 'down' ? 'decreasing' : 'stable'}`}
            aria-hidden="false"
          />
        )}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="text-3xl font-semibold text-gray-900"
          aria-labelledby={`tile-label-${label.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {value}
        </div>
        {evidenceId && evidence && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="text-gray-400 hover:text-gray-600"
                  aria-label={`Peer-reviewed evidence for ${label}: ${evidence.title}`}
                  aria-describedby={`evidence-tooltip-${evidenceId}`}
                  aria-expanded="false"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                  <span className="sr-only">Show peer-reviewed evidence citation</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                className="max-w-sm bg-gray-900 text-white"
                id={`evidence-tooltip-${evidenceId}`}
                role="tooltip"
                aria-live="polite"
              >
                <div className="space-y-2">
                  <div className="font-semibold text-sm">Peer-Reviewed Evidence</div>
                  <div className="text-xs">
                    <div className="font-medium">{evidence.title}</div>
                    <div className="mt-1 text-gray-300">
                      {evidence.journal && <span>{evidence.journal}. </span>}
                      {evidence.authors.length > 0 && (
                        <span>{evidence.authors[0]}{evidence.authors.length > 1 ? ' et al.' : ''}</span>
                      )}
                    </div>
                    <div className="mt-2 text-gray-400">
                      <div>DOI: <span className="font-mono text-xs">{evidence.doi}</span></div>
                      <div className="mt-1 pt-1 border-t border-gray-700">
                        <span className="text-gray-500">SR:</span>{' '}
                        <span className="font-mono text-xs ml-1">
                          {evidence.metadata?.srLabel ||
                           (evidence.journal && evidence.metadata?.publishedYear
                             ? `${evidence.journal} ${evidence.metadata.publishedYear}`
                             : evidence.journal || 'Systematic Review')}
                        </span>
                      </div>
                      {evidence.metadata?.studyType && (
                        <div className="mt-1 text-gray-500 text-[10px]">
                          Study Type: {evidence.metadata.studyType}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {/* Trendline visualization */}
      {chartData.length > 0 && (
        <div className="h-16 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <XAxis dataKey="date" hide />
              <YAxis hide />
              <RechartsTooltip contentStyle={{ display: 'none' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function SLODashboardPage() {
  const [metrics, setMetrics] = useState<SLOMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [evidence, setEvidence] = useState<EvidenceData | null>(null);
  const [trendlineFilter, setTrendlineFilter] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  // Fetch evidence for JAMA study (ambient-AI)
  useEffect(() => {
    fetch('/api/evidence/registry?tag=ambient-AI&journal=JAMA')
      .then(res => res.json())
      .then(data => {
        if (data.evidence && data.evidence.length > 0) {
          setEvidence(data.evidence[0]);
        }
      })
      .catch(() => {});
  }, []);

  const fetchMetrics = async () => {
    try {
      setError(null);
      const response = await fetch('/api/metrics-summary', {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }

      const data = await response.json();
      setMetrics(data);
      setLastRefresh(new Date());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load SLO metrics';
      setError(message);
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 30000); // 30s refresh
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);


  if (loading && !metrics) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
        <header className="border-b bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-blue-600" />
              <span className="text-2xl font-bold text-gray-900">VitalCV</span>
            </Link>
          </div>
        </header>
        <div className="container mx-auto px-4 py-12">
          <div className="p-8 opacity-60">Loading SLOs…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">VitalCV</span>
          </Link>
          <Link href="/dashboard" className="text-gray-600 hover:text-blue-600">
            Back to Dashboard
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">SLO Dashboard</h1>
            <p className="text-gray-600">Service Level Objectives and Performance Metrics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Trendline:</span>
              <select
                value={trendlineFilter}
                onChange={(e) => setTrendlineFilter(e.target.value as '7d' | '30d' | '90d' | 'all')}
                className="text-sm border rounded px-2 py-1"
              >
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
                <option value="90d">90 days</option>
                <option value="all">All time</option>
              </select>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'bg-blue-50' : ''}
            >
              Auto-refresh: {autoRefresh ? 'ON' : 'OFF'}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchMetrics} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {metrics && (
          <>
            {/* Simplified SLO Tiles */}
            <div className="grid gap-4 p-8 md:grid-cols-5 mb-6">
              <Tile label="PSV Success" value={metrics.psvSuccess} />
              <Tile label="PSV Fail" value={metrics.psvFail} />
              <Tile
                label="Evidence Complete %"
                value={metrics.evidenceCompleteRatio ? (metrics.evidenceCompleteRatio * 100).toFixed(1) : '0.0'}
              />
              <Tile label="TTP P50 (days)" value={metrics.ttpDaysP50 ? metrics.ttpDaysP50.toFixed(1) : '—'} />
              <Tile
                label="Minutes-in-notes"
                value={metrics.minutesInNotes ? `${metrics.minutesInNotes.toFixed(1)} min` : '—'}
                evidenceId={evidence?.id}
                trend="down"
                trendlineFilter={trendlineFilter}
                trendlineData={[
                  { date: 'W1', value: 15.2 },
                  { date: 'W2', value: 14.8 },
                  { date: 'W3', value: 14.1 },
                  { date: 'W4', value: 13.5 },
                  { date: 'W5', value: 13.0 },
                  { date: 'W6', value: 12.7 },
                  { date: 'W7', value: 12.5 },
                ]}
              />
            </div>

            {/* Last Updated */}
            <div className="text-sm text-gray-500 text-center">
              Last updated: {new Date(metrics.timestamp).toLocaleString()}{' '}
              {lastRefresh && `• Refreshed: ${lastRefresh.toLocaleTimeString()}`}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

