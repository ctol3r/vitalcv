"use client";

import { useEffect, useState } from 'react';

export interface Program {
  program_id: string;
  name: string;
  institution: string;
  country: string;
  accreditor: string;
  level: string;
}

interface Props {
  onSelect: (program: Program) => void;
}

/**
 * EducationProgramInput - Autocomplete input for residency/fellowship programs
 * Searches against /api/programs/search endpoint
 */
export default function EducationProgramInput({ onSelect }: Props) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q) {
        setRows([]);
        return;
      }

      setLoading(true);
      try {
        const r = await fetch(`/api/programs/search?q=${encodeURIComponent(q)}`);
        const js = await r.json();
        setRows(js.rows || []);
      } catch (err) {
        console.error('Program search failed:', err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative">
      <input
        className="p-2 border rounded w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Search program (e.g., Internal Medicine)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search education program"
      />

      {loading && (
        <div className="absolute right-3 top-3 text-gray-400 text-sm">
          Loading...
        </div>
      )}

      {rows.length > 0 && (
        <div className="mt-1 border rounded shadow-lg bg-white max-h-64 overflow-y-auto">
          {rows.slice(0, 8).map((r) => (
            <div
              key={r.program_id}
              className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 transition-colors"
              onClick={() => {
                onSelect(r);
                setQ(r.name);
                setRows([]);
              }}
            >
              <div className="font-medium text-sm">{r.name}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {r.institution} • {r.country}
              </div>
              <div className="mt-1">
                <span className="text-[10px] px-1.5 py-0.5 border rounded bg-blue-50 text-blue-700">
                  {r.accreditor}
                </span>
                <span className="text-[10px] ml-1.5 px-1.5 py-0.5 border rounded bg-gray-50 text-gray-700">
                  {r.level}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

