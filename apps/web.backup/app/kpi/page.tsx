/**
 * B128C-FE-031: KPI Dashboard with Minutes-in-notes tile
 *
 * Features:
 * - Citation tooltip linking to evidence
 * - Trendline with filters
 * - Screen reader labels
 */

'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Info, TrendingDown, Calendar } from 'lucide-react';

interface KPIData {
  date: string;
  minutesInNotes: number;
  baseline: number;
}

interface EvidenceLink {
  title: string;
  doi: string;
  url: string;
  finding: string;
}

export default function KPIDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [kpiData, setKpiData] = useState<KPIData[]>([]);
  const [evidence, setEvidence] = useState<EvidenceLink | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch KPI data and evidence
    fetchKPIData();
    fetchEvidence();
  }, [timeRange]);

  async function fetchKPIData() {
    try {
      // In production, fetch from API
      // const response = await fetch(`/api/kpi/minutes-in-notes?range=${timeRange}`);
      // const data = await response.json();

      // Mock data for demo
      const mockData = generateMockData(timeRange);
      setKpiData(mockData);
    } catch (error) {
      console.error('Failed to fetch KPI data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEvidence() {
    try {
      const response = await fetch('/api/evidence/kpi/minutes-in-notes');
      const data = await response.json();

      if (data.success && data.evidence.length > 0) {
        const study = data.evidence[0].studyData;
        setEvidence({
          title: study.title,
          doi: study.doi,
          url: study.url,
          finding: `${(study.keyFindings.documentationTimeReduction * 100).toFixed(1)}% reduction in documentation time`
        });
      }
    } catch (error) {
      console.error('Failed to fetch evidence:', error);
    }
  }

  function generateMockData(range: string): KPIData[] {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const data: KPIData[] = [];
    const baseline = 45; // minutes

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Simulate gradual improvement
      const improvement = (days - i) / days * 0.15; // 15% improvement over time
      const minutesInNotes = baseline * (1 - improvement) + (Math.random() * 3 - 1.5);

      data.push({
        date: date.toISOString().split('T')[0],
        minutesInNotes: Math.round(minutesInNotes * 10) / 10,
        baseline
      });
    }

    return data;
  }

  const currentAvg = kpiData.length > 0
    ? Math.round((kpiData.reduce((sum, d) => sum + d.minutesInNotes, 0) / kpiData.length) * 10) / 10
    : 0;

  const previousAvg = 45; // baseline
  const improvement = ((previousAvg - currentAvg) / previousAvg * 100).toFixed(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen" role="status" aria-live="polite">
        <div className="text-lg">Loading KPI data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-2">KPI Dashboard</h1>
        <p className="text-gray-600">Performance metrics and clinical efficiency indicators</p>
      </header>

      {/* Minutes in Notes KPI Tile */}
      <section
        className="bg-white rounded-lg shadow-lg p-6 mb-6"
        aria-labelledby="minutes-in-notes-heading"
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 id="minutes-in-notes-heading" className="text-xl font-semibold flex items-center gap-2">
              Minutes Spent in Clinical Notes
              {evidence && (
                <button
                  className="relative group"
                  aria-label="View research evidence"
                  type="button"
                >
                  <Info size={18} className="text-blue-500 hover:text-blue-700 cursor-help" />

                  {/* Citation Tooltip */}
                  <div className="absolute left-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-lg shadow-xl p-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="font-semibold mb-2">{evidence.title}</div>
                    <div className="text-gray-300 mb-2">
                      <strong>Finding:</strong> {evidence.finding}
                    </div>
                    <a
                      href={evidence.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-300 hover:text-blue-100 underline inline-flex items-center gap-1"
                    >
                      View study (DOI: {evidence.doi})
                      <span aria-hidden="true">→</span>
                    </a>
                    <div className="absolute -top-2 left-4 w-4 h-4 bg-gray-900 transform rotate-45"></div>
                  </div>
                </button>
              )}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Average daily time spent documenting patient encounters
            </p>
          </div>

          <div className="flex items-center gap-2 text-green-600" aria-label={`Improved by ${improvement} percent`}>
            <TrendingDown size={20} />
            <span className="font-semibold">{improvement}% ↓</span>
          </div>
        </div>

        {/* Current Value */}
        <div className="mb-6">
          <div className="text-4xl font-bold text-gray-900" role="status" aria-live="polite">
            {currentAvg} <span className="text-2xl text-gray-600">minutes</span>
          </div>
          <div className="text-sm text-gray-500 mt-1">
            vs. {previousAvg} min baseline
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="mb-4 flex items-center gap-2">
          <Calendar size={16} className="text-gray-500" />
          <label htmlFor="time-range" className="text-sm font-medium text-gray-700 sr-only">
            Select time range
          </label>
          <select
            id="time-range"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Time range filter"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>

        {/* Trendline Chart */}
        <div className="w-full h-64" role="img" aria-label="Minutes in notes trendline chart showing improvement over time">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={kpiData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                labelFormatter={(value) => `Date: ${value}`}
                formatter={(value: number) => [`${value} min`, '']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="minutesInNotes"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Minutes in Notes"
                dot={{ fill: '#3b82f6', r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="#9ca3af"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Baseline"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Screen Reader Summary */}
        <div className="sr-only" role="status" aria-live="polite">
          Minutes in notes KPI shows an average of {currentAvg} minutes,
          which is a {improvement}% improvement from the baseline of {previousAvg} minutes.
          {evidence && ` Research evidence: ${evidence.finding}.`}
        </div>
      </section>

      {/* Additional KPIs can be added here */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Patient Face Time</h3>
          <div className="text-3xl font-bold text-green-600">+23.4%</div>
          <p className="text-sm text-gray-600 mt-1">vs. baseline</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Documentation Efficiency</h3>
          <div className="text-3xl font-bold text-blue-600">87%</div>
          <p className="text-sm text-gray-600 mt-1">compliance rate</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Clinician Burnout</h3>
          <div className="text-3xl font-bold text-green-600">-13.1%</div>
          <p className="text-sm text-gray-600 mt-1">reduction</p>
        </div>
      </section>
    </div>
  );
}
