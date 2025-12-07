'use client';

/**
 * Pilot SLO Detail View
 * B133A-FE-007: Line charts for uptime, error rate, and latency with filters and SR labels
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface TimeSeriesDataPoint {
  timestamp: string;
  tests: number;
  successRate: number;
  errorRate: number;
  avgDuration: number;
}

interface MetricsData {
  periodStart: string;
  periodEnd: string;
  timeSeries: TimeSeriesDataPoint[];
  totalDataPoints: number;
}

export default function PilotSloDetailPage() {
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [selectedMetric, setSelectedMetric] = useState<'uptime' | 'errorRate' | 'latency'>('uptime');

  const fetchMetrics = async (daysParam: number) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/pilot/metrics?days=${daysParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      const data = await response.json();
      setMetricsData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(days);
  }, [days]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading SLO metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !metricsData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-center mb-2">Error Loading Metrics</h2>
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

  // Calculate min/max for scaling
  const uptimeValues = metricsData.timeSeries.map(d => d.successRate);
  const errorValues = metricsData.timeSeries.map(d => d.errorRate);
  const latencyValues = metricsData.timeSeries.map(d => d.avgDuration);

  const minUptime = Math.min(...uptimeValues, 98);
  const maxUptime = 100;
  const maxError = Math.max(...errorValues, 2);
  const maxLatency = Math.max(...latencyValues, 1000);

  // Simple SVG chart renderer
  const renderChart = () => {
    if (metricsData.timeSeries.length === 0) {
      return (
        <div className="text-center text-gray-500 py-12">
          No data available for the selected period
        </div>
      );
    }

    const width = 800;
    const height = 400;
    const padding = { top: 20, right: 60, bottom: 60, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    let values: number[];
    let threshold: number;
    let thresholdLabel: string;
    let yLabel: string;
    let color: string;

    switch (selectedMetric) {
      case 'uptime':
        values = uptimeValues;
        threshold = 99.5;
        thresholdLabel = '99.5% (SLO)';
        yLabel = 'Uptime %';
        color = '#10b981'; // green
        break;
      case 'errorRate':
        values = errorValues;
        threshold = 1.0;
        thresholdLabel = '1% (SLO)';
        yLabel = 'Error Rate %';
        color = '#ef4444'; // red
        break;
      case 'latency':
        values = latencyValues;
        threshold = 2000;
        thresholdLabel = '2000ms (SLO)';
        yLabel = 'Avg Latency (ms)';
        color = '#3b82f6'; // blue
        break;
    }

    const min = selectedMetric === 'uptime' ? minUptime : 0;
    const max = selectedMetric === 'uptime'
      ? maxUptime
      : selectedMetric === 'errorRate'
      ? maxError
      : maxLatency;

    // Generate points
    const points = values.map((value, i) => {
      const x = padding.left + (i / (values.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((value - min) / (max - min)) * chartHeight;
      return `${x},${y}`;
    }).join(' ');

    // Threshold line Y position
    const thresholdY = padding.top + chartHeight - ((threshold - min) / (max - min)) * chartHeight;

    return (
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className="mx-auto"
          role="img"
          aria-label={`${yLabel} chart`}
        >
          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={height - padding.bottom}
            stroke="#d1d5db"
            strokeWidth="2"
          />

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={height - padding.bottom}
            x2={width - padding.right}
            y2={height - padding.bottom}
            stroke="#d1d5db"
            strokeWidth="2"
          />

          {/* Threshold line */}
          {thresholdY >= padding.top && thresholdY <= height - padding.bottom && (
            <>
              <line
                x1={padding.left}
                y1={thresholdY}
                x2={width - padding.right}
                y2={thresholdY}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              <text
                x={width - padding.right + 5}
                y={thresholdY + 5}
                fontSize="12"
                fill="#f59e0b"
              >
                {thresholdLabel}
              </text>
            </>
          )}

          {/* Data line */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="3"
          />

          {/* Data points */}
          {values.map((value, i) => {
            const x = padding.left + (i / (values.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((value - min) / (max - min)) * chartHeight;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={color}
              />
            );
          })}

          {/* Y-axis label */}
          <text
            x={padding.left - 50}
            y={padding.top + chartHeight / 2}
            fontSize="14"
            fill="#6b7280"
            textAnchor="middle"
            transform={`rotate(-90, ${padding.left - 50}, ${padding.top + chartHeight / 2})`}
          >
            {yLabel}
          </text>

          {/* X-axis label */}
          <text
            x={padding.left + chartWidth / 2}
            y={height - 10}
            fontSize="14"
            fill="#6b7280"
            textAnchor="middle"
          >
            Time
          </text>

          {/* Y-axis ticks */}
          {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
            const value = min + ratio * (max - min);
            const y = padding.top + chartHeight - ratio * chartHeight;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left - 5}
                  y1={y}
                  x2={padding.left}
                  y2={y}
                  stroke="#d1d5db"
                  strokeWidth="2"
                />
                <text
                  x={padding.left - 10}
                  y={y + 5}
                  fontSize="12"
                  fill="#6b7280"
                  textAnchor="end"
                >
                  {value.toFixed(selectedMetric === 'latency' ? 0 : 1)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/admin/pilot"
              className="text-blue-600 hover:text-blue-800"
              aria-label="Back to pilot dashboard"
            >
              ← Back
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">SLO Detail View</h1>
          </div>
          <p className="text-gray-600">
            Historical trends for uptime, error rate, and anchor latency metrics
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Time Range Selector */}
            <div>
              <label htmlFor="days-select" className="block text-sm font-medium text-gray-700 mb-2">
                Time Range
              </label>
              <select
                id="days-select"
                value={days}
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={1}>Last 24 hours</option>
                <option value={3}>Last 3 days</option>
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
              </select>
            </div>

            {/* Metric Selector */}
            <div>
              <label htmlFor="metric-select" className="block text-sm font-medium text-gray-700 mb-2">
                Metric
              </label>
              <select
                id="metric-select"
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="uptime">Uptime (Success Rate)</option>
                <option value="errorRate">Error Rate</option>
                <option value="latency">Average Latency</option>
              </select>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {selectedMetric === 'uptime' && 'Uptime Trend'}
            {selectedMetric === 'errorRate' && 'Error Rate Trend'}
            {selectedMetric === 'latency' && 'Latency Trend'}
          </h2>

          {renderChart()}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Average Uptime</div>
            <div className="text-2xl font-bold text-gray-900">
              {(uptimeValues.reduce((a, b) => a + b, 0) / uptimeValues.length).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Threshold: ≥99.5%
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Average Error Rate</div>
            <div className="text-2xl font-bold text-gray-900">
              {(errorValues.reduce((a, b) => a + b, 0) / errorValues.length).toFixed(2)}%
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Threshold: &lt;1%
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
            <div className="text-sm text-gray-600 mb-1">Average Latency</div>
            <div className="text-2xl font-bold text-gray-900">
              {Math.round(latencyValues.reduce((a, b) => a + b, 0) / latencyValues.length)}ms
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Threshold: &lt;2000ms (P95)
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm overflow-x-auto">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Raw Data</h3>
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Timestamp
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tests
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Latency
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {metricsData.timeSeries.slice().reverse().map((dataPoint, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {new Date(dataPoint.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {dataPoint.tests}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-green-600">
                    {dataPoint.successRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-red-600">
                    {dataPoint.errorRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {Math.round(dataPoint.avgDuration)}ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

