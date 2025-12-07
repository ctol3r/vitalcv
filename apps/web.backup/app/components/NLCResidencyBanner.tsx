"use client";
import { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

interface Move {
  id: string;
  fromState: string;
  toState: string;
  moveDate: string;
  breachDate: string;
  status: string;
  alertsSent: string[];
}

export default function NLCResidencyBanner({ npi }: { npi: string }) {
  const [move, setMove] = useState<Move | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch pending moves for this NPI
    const fetchMove = async () => {
      try {
        // Mock for now - replace with actual API call
        const mockMove: Move = {
          id: '1',
          fromState: 'TX',
          toState: 'FL',
          moveDate: '2025-10-01T00:00:00.000Z',
          breachDate: '2025-11-30T00:00:00.000Z',
          status: 'pending',
          alertsSent: [],
        };
        setMove(mockMove);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMove();
  }, [npi]);

  if (loading || !move || move.status !== 'pending' || dismissed) {
    return null;
  }

  const breachDate = new Date(move.breachDate);
  const now = new Date();
  const daysRemaining = Math.ceil(
    (breachDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const isUrgent = daysRemaining <= 14;

  return (
    <div
      className={`relative mb-4 p-4 rounded-lg border ${
        isUrgent
          ? 'bg-red-50 border-red-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
      >
        <X size={20} />
      </button>

      <div className="flex items-start gap-3 pr-8">
        <AlertTriangle
          size={24}
          className={isUrgent ? 'text-red-600' : 'text-yellow-600'}
        />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            NLC Residency Move: Action Required
          </h3>
          <p className="text-sm text-gray-700 mb-2">
            You moved your NLC home state from <strong>{move.fromState}</strong>{' '}
            to <strong>{move.toState}</strong> on{' '}
            {new Date(move.moveDate).toLocaleDateString()}. You must obtain a
            new multistate license within 60 days.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <div
              className={`text-lg font-bold ${
                isUrgent ? 'text-red-700' : 'text-yellow-700'
              }`}
            >
              {daysRemaining} days remaining
            </div>
            <div className="text-xs text-gray-600">
              (Due: {breachDate.toLocaleDateString()})
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center gap-1">
              Apply for Multistate License
              <ExternalLink size={14} />
            </button>
            <button className="px-3 py-1.5 bg-gray-200 text-gray-800 text-sm rounded hover:bg-gray-300">
              Upload Proof of Application
            </button>
            <button className="px-3 py-1.5 text-blue-600 text-sm hover:underline">
              View NLC Requirements
            </button>
          </div>

          {isUrgent && (
            <div className="mt-3 text-xs text-red-700 flex items-center gap-1">
              <AlertTriangle size={14} />
              <span>
                <strong>Warning:</strong> Remote-state practice will be blocked
                after the deadline.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

