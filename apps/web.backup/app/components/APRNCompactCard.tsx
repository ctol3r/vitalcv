"use client";
import { useState, useEffect } from 'react';
import { CheckCircle, Clock, MapPin } from 'lucide-react';

interface CompactState {
  state: string;
  status: 'active' | 'pending' | 'inactive';
}

export default function APRNCompactCard({ npi }: { npi: string }) {
  const [states, setStates] = useState<CompactState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCompactStatus = async () => {
      try {
        const res = await fetch('/api/compacts?compact=aprn');
        const data = await res.json();

        // Mock membership status for demo
        const mockStates: CompactState[] = [
          { state: 'AR', status: 'active' },
          { state: 'DE', status: 'active' },
          { state: 'ID', status: 'pending' },
          { state: 'IA', status: 'active' },
          { state: 'KS', status: 'pending' },
        ];

        setStates(mockStates);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCompactStatus();
  }, [npi]);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
        <div className="animate-pulse h-3 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  const activeStates = states.filter((s) => s.status === 'active');
  const pendingStates = states.filter((s) => s.status === 'pending');

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <MapPin size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">APRN Compact Membership</h3>
      </div>

      <div className="mb-4">
        <div className="text-sm text-gray-600 mb-2">
          Practice enabled in {activeStates.length} compact states
        </div>
        <div className="flex flex-wrap gap-1.5">
          {states.map((s) => (
            <div
              key={s.state}
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                s.status === 'active'
                  ? 'bg-green-100 text-green-800 border border-green-300'
                  : s.status === 'pending'
                  ? 'bg-gray-100 text-gray-500 border border-gray-300'
                  : 'bg-red-100 text-red-800'
              }`}
              title={
                s.status === 'pending'
                  ? `${s.state}: License pending issuance`
                  : `${s.state}: ${s.status}`
              }
            >
              <span className="flex items-center gap-1">
                {s.status === 'active' ? (
                  <CheckCircle size={12} />
                ) : s.status === 'pending' ? (
                  <Clock size={12} />
                ) : null}
                {s.state}
              </span>
            </div>
          ))}
        </div>
      </div>

      {pendingStates.length > 0 && (
        <div className="pt-3 border-t text-xs text-gray-600">
          <div className="flex items-center gap-1 mb-1">
            <Clock size={14} className="text-gray-500" />
            <span className="font-medium">Pending licenses:</span>
          </div>
          <ul className="ml-5 list-disc space-y-1">
            {pendingStates.map((s) => (
              <li key={s.state}>
                {s.state} — Awaiting state board issuance
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

