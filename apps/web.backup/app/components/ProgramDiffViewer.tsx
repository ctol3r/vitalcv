"use client";
import { useState, useEffect } from 'react';
import { Plus, Minus, Edit, Filter } from 'lucide-react';

interface Program {
  programId: string;
  name: string;
  institution: string;
  country: string;
  accreditor?: string;
  specialty?: string;
}

interface Diff {
  added: Program[];
  changed: Program[];
  removed: Program[];
}

export default function ProgramDiffViewer() {
  const [diff, setDiff] = useState<Diff>({ added: [], changed: [], removed: [] });
  const [countryFilter, setCountryFilter] = useState('');
  const [accreditorFilter, setAccreditorFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest diff
    const fetchDiff = async () => {
      try {
        // Mock data for demo
        const mockDiff: Diff = {
          added: [
            {
              programId: 'NEW-001',
              name: 'Family Medicine Residency',
              institution: 'City Hospital',
              country: 'US',
              accreditor: 'ACGME',
              specialty: 'family medicine',
            },
            {
              programId: 'NEW-002',
              name: 'Internal Medicine Residency',
              institution: 'Metro Medical Center',
              country: 'CA',
              accreditor: 'Royal College',
              specialty: 'internal medicine',
            },
          ],
          changed: [
            {
              programId: 'CHG-001',
              name: 'Cardiology Fellowship (Updated)',
              institution: 'University Hospital',
              country: 'US',
              accreditor: 'ACGME',
              specialty: 'cardiology',
            },
          ],
          removed: [
            {
              programId: 'REM-001',
              name: 'Outdated Program',
              institution: 'Closed Hospital',
              country: 'US',
            },
          ],
        };
        setDiff(mockDiff);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, []);

  if (loading) {
    return <div className="p-4">Loading diff...</div>;
  }

  const allItems = [
    ...diff.added.map((p) => ({ ...p, type: 'added' as const })),
    ...diff.changed.map((p) => ({ ...p, type: 'changed' as const })),
    ...diff.removed.map((p) => ({ ...p, type: 'removed' as const })),
  ].filter((item) => {
    if (countryFilter && item.country !== countryFilter) return false;
    if (accreditorFilter && item.accreditor !== accreditorFilter) return false;
    return true;
  });

  const pageSize = 20;
  const paged = allItems.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(allItems.length / pageSize);

  return (
    <div className="p-6 border rounded-lg bg-white">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Program ETL Diff Viewer
      </h2>

      {/* Summary */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="flex items-center gap-1 text-green-700">
          <Plus size={16} />
          <span>Added: {diff.added.length}</span>
        </div>
        <div className="flex items-center gap-1 text-blue-700">
          <Edit size={16} />
          <span>Changed: {diff.changed.length}</span>
        </div>
        <div className="flex items-center gap-1 text-red-700">
          <Minus size={16} />
          <span>Removed: {diff.removed.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-600" />
          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="px-3 py-1.5 border rounded text-sm"
          >
            <option value="">All Countries</option>
            <option value="US">US</option>
            <option value="CA">CA</option>
            <option value="UK">UK</option>
          </select>
        </div>
        <select
          value={accreditorFilter}
          onChange={(e) => setAccreditorFilter(e.target.value)}
          className="px-3 py-1.5 border rounded text-sm"
        >
          <option value="">All Accreditors</option>
          <option value="ACGME">ACGME</option>
          <option value="Royal College">Royal College</option>
          <option value="GMC">GMC</option>
        </select>
      </div>

      {/* Diff list */}
      <div className="space-y-2 mb-4">
        {paged.map((item) => (
          <div
            key={item.programId}
            className={`p-3 border-l-4 rounded ${
              item.type === 'added'
                ? 'bg-green-50 border-green-500'
                : item.type === 'changed'
                ? 'bg-blue-50 border-blue-500'
                : 'bg-red-50 border-red-500'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-600">
                  {item.institution} • {item.country}
                  {item.accreditor && ` • ${item.accreditor}`}
                  {item.specialty && ` • ${item.specialty}`}
                </div>
              </div>
              <div
                className={`px-2 py-0.5 rounded text-xs font-medium ${
                  item.type === 'added'
                    ? 'bg-green-100 text-green-800'
                    : item.type === 'changed'
                    ? 'bg-blue-100 text-blue-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {item.type}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

