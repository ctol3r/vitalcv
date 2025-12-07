'use client';

/**
 * Pilot Readiness Dashboard
 * B133A-FE-006: Displays PASS/FAIL status, countdown to 7-day mark, and SLO criteria
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PilotStatus {
  status: 'pass' | 'fail' | 'warning' | 'unknown';
  passed: boolean;
  timestamp: string;
  evaluation: {
    periodStart: string;
    periodEnd: string;
    ageHours: number;
    errorBudgetConsumed: number;
  };
  metrics: Array<{
    metric: string;
    value: number;
    threshold: number;
    status: string;
    details: string;
  }>;
  reasons: string[];
  latestSmokeTest: {
    success: boolean;
    timestamp: string;
    duration: number;
  } | null;
  countdownToLaunch: {
    daysRemaining: number;
    hoursRemaining: number;
    targetDate: string;
    ready: boolean;
  };
}

export default function PilotReadinessPage() {
  const [status, setStatus] = useState<PilotStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/pilot/status');
      if (!response.ok) {
        throw new Error('Failed to fetch pilot status');
      }
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pilot readiness status...</p>
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Error Loading Status</h2>
          <p className="text-gray-600 text-center mb-4">{error || 'Unknown error'}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const statusColor = status.passed
    ? 'bg-green-100 border-green-400 text-green-800'
    : 'bg-red-100 border-red-400 text-red-800';

  const statusIcon = status.passed ? '✓' : '✗';
  const statusText = status.passed ? 'PASS' : 'FAIL';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">Pilot Readiness Dashboard</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  autoRefresh
                    ? 'bg-green-100 text-green-800 hover:bg-green-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                aria-label={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
              >
                {autoRefresh ? '🔄 Auto-refresh ON' : '⏸️ Auto-refresh OFF'}
              </button>
              <button
                onClick={fetchStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                aria-label="Refresh status now"
              >
                Refresh Now
              </button>
            </div>
          </div>
          <p className="text-gray-600">
            Real-time monitoring of pilot readiness SLOs and smoke test results
          </p>
        </div>

        {/* Main Status Card */}
        <div className={`rounded-lg border-2 ${statusColor} p-6 mb-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-6xl" aria-hidden="true">{statusIcon}</div>
              <div>
                <h2 className="text-2xl font-bold mb-1">{statusText}</h2>
                <p className="text-sm opacity-90">
                  Pilot Status: {status.passed ? 'Ready for launch' : 'Not ready'}
                </p>
              </div>
            </div>

            {/* Countdown */}
            {!status.countdownToLaunch.ready && (
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {status.countdownToLaunch.daysRemaining}d {status.countdownToLaunch.hoursRemaining % 24}h
                </div>
                <p className="text-sm opacity-90">Until 7-day mark</p>
                <p className="text-xs opacity-75 mt-1">
                  Target: {new Date(status.countdownToLaunch.targetDate).toLocaleDateString()}
                </p>
              </div>
            )}

            {status.countdownToLaunch.ready && status.passed && (
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">🚀</div>
                <p className="text-sm opacity-90">Ready to Launch!</p>
              </div>
            )}
          </div>

          {/* Reasons */}
          {status.reasons && status.reasons.length > 0 && (
            <div className="mt-4 pt-4 border-t border-current border-opacity-20">
              <h3 className="font-semibold mb-2">Details:</h3>
              <ul className="space-y-1">
                {status.reasons.map((reason, idx) => (
                  <li key={idx} className="text-sm flex items-start gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* SLO Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {status.metrics.map((metric, idx) => {
            const isPassing = metric.status === 'pass';
            const bgColor = isPassing ? 'bg-white' : 'bg-red-50';
            const borderColor = isPassing ? 'border-gray-200' : 'border-red-200';

            return (
              <div
                key={idx}
                className={`${bgColor} border ${borderColor} rounded-lg p-5 shadow-sm`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
                    {metric.metric.replace('_', ' ')}
                  </h3>
                  <span
                    className={`text-2xl ${isPassing ? 'text-green-600' : 'text-red-600'}`}
                    aria-label={isPassing ? 'Passing' : 'Failing'}
                  >
                    {isPassing ? '✓' : '✗'}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="text-3xl font-bold text-gray-900">
                    {metric.metric === 'anchorP95Latency'
                      ? `${Math.round(metric.value)}ms`
                      : `${metric.value.toFixed(2)}%`}
                  </div>
                  <div className="text-sm text-gray-500">
                    Threshold:{' '}
                    {metric.metric === 'anchorP95Latency'
                      ? `${metric.threshold}ms`
                      : metric.metric === 'errorRate'
                      ? `<${metric.threshold}%`
                      : `≥${metric.threshold}%`}
                  </div>
                </div>

                <p className="text-sm text-gray-600">{metric.details}</p>
              </div>
            );
          })}
        </div>

        {/* Error Budget */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Error Budget</h3>
            <span className="text-sm text-gray-500">
              {status.evaluation.errorBudgetConsumed.toFixed(1)}% consumed
            </span>
          </div>

          <div className="relative pt-1">
            <div className="overflow-hidden h-4 text-xs flex rounded bg-gray-200">
              <div
                style={{ width: `${Math.min(status.evaluation.errorBudgetConsumed, 100)}%` }}
                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${
                  status.evaluation.errorBudgetConsumed > 80
                    ? 'bg-red-500'
                    : status.evaluation.errorBudgetConsumed > 50
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                role="progressbar"
                aria-valuenow={status.evaluation.errorBudgetConsumed}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600 mt-2">
            Error budget tracks allowed downtime. Over 80% consumption triggers critical alerts.
          </p>
        </div>

        {/* Latest Smoke Test */}
        {status.latestSmokeTest && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Latest Smoke Test</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Status</div>
                <div className={`font-semibold ${status.latestSmokeTest.success ? 'text-green-600' : 'text-red-600'}`}>
                  {status.latestSmokeTest.success ? '✓ Passed' : '✗ Failed'}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Duration</div>
                <div className="font-semibold text-gray-900">
                  {status.latestSmokeTest.duration}ms
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-600 mb-1">Timestamp</div>
                <div className="font-semibold text-gray-900">
                  {new Date(status.latestSmokeTest.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/pilot/slo"
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h4 className="font-semibold text-gray-900 mb-1">📊 Detailed SLO View</h4>
            <p className="text-sm text-gray-600">View charts and historical trends</p>
          </Link>

          <Link
            href="/admin/pilot/health"
            className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all"
          >
            <h4 className="font-semibold text-gray-900 mb-1">🏥 Health Checks</h4>
            <p className="text-sm text-gray-600">View system health status</p>
          </Link>

          <button
            onClick={async () => {
              if (confirm('Trigger a manual smoke test? This may take 30+ seconds.')) {
                try {
                  const response = await fetch('/api/pilot/smoke', { method: 'POST' });
                  const result = await response.json();
                  alert(result.success ? '✓ Smoke test passed!' : '✗ Smoke test failed: ' + result.errorMessage);
                  fetchStatus();
                } catch (error) {
                  alert('Failed to run smoke test');
                }
              }
            }}
            className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <h4 className="font-semibold text-gray-900 mb-1">🧪 Run Smoke Test</h4>
            <p className="text-sm text-gray-600">Manually trigger end-to-end test</p>
          </button>
        </div>

        {/* Tooltip Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-900 mb-2">SLO Criteria</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li><strong>Uptime ≥99.5%:</strong> System must be available 99.5% of the time (allows ~3.5 hours downtime per month)</li>
            <li><strong>Error Rate &lt;1%:</strong> Less than 1% of requests should fail</li>
            <li><strong>Anchor P95 Latency &lt;2s:</strong> 95% of anchor operations must complete within 2 seconds</li>
            <li><strong>7-Day Window:</strong> All metrics evaluated over rolling 7-day period</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

