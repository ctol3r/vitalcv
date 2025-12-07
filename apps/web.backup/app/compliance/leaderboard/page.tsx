"use client";
import { useEffect, useState } from 'react';

interface LeaderboardRow {
  npi: string;
  pct: number;
  grade: string;
  overdue: string[];
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/compliance/leaderboard?limit=50');
        const js = await r.json();
        setRows(js.rows || []);
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function exportCSV() {
    const head = 'npi,pct,grade,overdue\n';
    const body = rows
      .map((r) => `${r.npi},${r.pct},${r.grade},"${(r.overdue || []).join(';')}"`)
      .join('\n');
    const blob = new Blob([head + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'psv_leaderboard.csv';
    a.click();
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'B':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'C':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">PSV Compliance Leaderboard</h1>
        <button
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50 transition-colors"
          onClick={exportCSV}
          disabled={rows.length === 0}
        >
          📊 Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading leaderboard...</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No data available</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="p-4 border rounded-lg text-sm flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => {
                window.location.href = `/compliance/leaderboard/${r.npi}`;
              }}
            >
              <div className="flex items-center gap-4">
                <span className="text-gray-500 font-mono">#{i + 1}</span>
                <a
                  href={`/physician/${r.npi}/timeline`}
                  className="font-bold text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {r.npi}
                </a>
              </div>
              <div className="flex items-center gap-4">
                <button
                  className="px-2 py-1 text-xs border rounded hover:bg-blue-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/compliance/leaderboard/${r.npi}`;
                  }}
                >
                  Fix
                </button>
                <span
                  className={`px-3 py-1 border rounded-md font-medium ${getGradeColor(r.grade)}`}
                >
                  {r.pct}% ({r.grade})
                </span>
                <span className="text-gray-600 text-xs">
                  {r.overdue && r.overdue.length > 0 ? (
                    <>
                      <span className="font-semibold">Overdue:</span> {r.overdue.join(', ')}
                    </>
                  ) : (
                    <span className="text-green-600">✓ All current</span>
                  )}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

