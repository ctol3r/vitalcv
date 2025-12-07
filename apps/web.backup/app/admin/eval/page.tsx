"use client";
import { useEffect, useState } from 'react';

interface EvalRecord {
  ts: string;
  details: {
    task: string;
    success: boolean;
    used: string[];
    durationMs?: number;
    stepsCount?: number;
    error?: string;
  };
}

export default function EvalDashboard() {
  const [rows, setRows] = useState<EvalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

  useEffect(() => {
    loadEvalResults();
  }, []);

  async function loadEvalResults() {
    try {
      const response = await fetch(`${BASE}/api/eval/recent`);
      const data = await response.json();
      setRows(data.rows || []);
    } catch (error) {
      console.error('Failed to load eval results:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredRows = rows.filter((row) => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'pass' && row.details.success) ||
      (filter === 'fail' && !row.details.success);

    const matchesSearch =
      !searchTerm ||
      row.details.task.toLowerCase().includes(searchTerm.toLowerCase()) ||
      row.details.used.some(tool => tool.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesFilter && matchesSearch;
  });

  const stats = {
    total: rows.length,
    passed: rows.filter(r => r.details.success).length,
    failed: rows.filter(r => !r.details.success).length,
    avgDuration: rows.length > 0
      ? Math.round(rows.reduce((sum, r) => sum + (r.details.durationMs || 0), 0) / rows.length)
      : 0,
  };

  return (
    <div className='max-w-7xl mx-auto py-8 px-4'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold'>Agent Evaluation Results</h1>
        <p className='text-sm text-gray-600 mt-1'>Monitor agent performance and test outcomes</p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-4 gap-4 mb-6'>
        <div className='p-4 bg-white border rounded-lg shadow-sm'>
          <div className='text-sm text-gray-600'>Total Runs</div>
          <div className='text-2xl font-bold mt-1'>{stats.total}</div>
        </div>
        <div className='p-4 bg-green-50 border border-green-200 rounded-lg shadow-sm'>
          <div className='text-sm text-green-700'>Passed</div>
          <div className='text-2xl font-bold text-green-800 mt-1'>{stats.passed}</div>
          <div className='text-xs text-green-600 mt-1'>
            {stats.total > 0 ? `${Math.round((stats.passed / stats.total) * 100)}%` : '0%'}
          </div>
        </div>
        <div className='p-4 bg-red-50 border border-red-200 rounded-lg shadow-sm'>
          <div className='text-sm text-red-700'>Failed</div>
          <div className='text-2xl font-bold text-red-800 mt-1'>{stats.failed}</div>
          <div className='text-xs text-red-600 mt-1'>
            {stats.total > 0 ? `${Math.round((stats.failed / stats.total) * 100)}%` : '0%'}
          </div>
        </div>
        <div className='p-4 bg-blue-50 border border-blue-200 rounded-lg shadow-sm'>
          <div className='text-sm text-blue-700'>Avg Duration</div>
          <div className='text-2xl font-bold text-blue-800 mt-1'>{stats.avgDuration}ms</div>
        </div>
      </div>

      {/* Filters */}
      <div className='mb-4 flex gap-3 flex-wrap items-center bg-white p-4 rounded-lg border shadow-sm'>
        <input
          type="text"
          placeholder="Search tasks or tools..."
          className='flex-1 min-w-[200px] px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className='flex gap-2'>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'pass'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('pass')}
          >
            Pass
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'fail'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('fail')}
          >
            Fail
          </button>
        </div>
        <button
          className='px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors'
          onClick={loadEvalResults}
        >
          Refresh
        </button>
      </div>

      {/* Results Table */}
      {loading ? (
        <div className='text-center py-12 text-gray-500'>Loading evaluation results...</div>
      ) : filteredRows.length === 0 ? (
        <div className='text-center py-12 bg-gray-50 rounded-lg border'>
          <div className='text-gray-500'>
            {searchTerm || filter !== 'all' ? 'No results match your filters' : 'No evaluation results yet'}
          </div>
          <div className='text-sm text-gray-400 mt-2'>
            Run <code className='bg-gray-200 px-2 py-1 rounded'>npm run eval:agent</code> to generate results
          </div>
        </div>
      ) : (
        <div className='space-y-3'>
          {filteredRows.map((row, i) => (
            <div
              key={i}
              className={`p-4 border rounded-lg shadow-sm ${
                row.details.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className='flex items-start justify-between gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-2 mb-2'>
                    <span className='text-lg'>{row.details.success ? '✅' : '❌'}</span>
                    <span className='font-semibold text-sm'>
                      {row.details.success ? 'PASS' : 'FAIL'}
                    </span>
                    <span className='text-xs text-gray-500'>
                      {new Date(row.ts).toLocaleString()}
                    </span>
                  </div>

                  <div className='text-sm mb-2'>
                    <span className='font-medium'>Task:</span> {row.details.task}
                  </div>

                  {row.details.used && row.details.used.length > 0 && (
                    <div className='flex flex-wrap gap-1 mb-2'>
                      <span className='text-xs text-gray-600'>Tools:</span>
                      {row.details.used.map((tool, idx) => (
                        <span
                          key={idx}
                          className='text-xs px-2 py-1 bg-white border rounded'
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className='flex gap-4 text-xs text-gray-600'>
                    {row.details.durationMs && (
                      <div>⏱️ {row.details.durationMs}ms</div>
                    )}
                    {row.details.stepsCount && (
                      <div>📊 {row.details.stepsCount} steps</div>
                    )}
                  </div>

                  {row.details.error && (
                    <div className='mt-2 text-xs text-red-700 bg-red-100 p-2 rounded'>
                      <span className='font-semibold'>Error:</span> {row.details.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

