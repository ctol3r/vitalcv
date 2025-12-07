"use client";
import { useState, useEffect } from 'react';
import { ExternalLink, FileText, CheckCircle } from 'lucide-react';

interface ExamRecord {
  npi: string;
  naplexVer: string;
  mpjeMode: string;
  examDate: string | null;
  evidenceUrls: {
    naplex_outline?: string;
    mpje_state_law?: string;
  };
}

export default function PharmacistEvidenceDrawer({ npi }: { npi: string }) {
  const [record, setRecord] = useState<ExamRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecord = async () => {
      try {
        const res = await fetch(`/api/pharmacist/exam/${npi}`);
        if (res.ok) {
          const data = await res.json();
          setRecord(data.record);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [npi]);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg">
        <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
        <div className="animate-pulse h-3 bg-gray-200 rounded w-full"></div>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="p-4 border rounded-lg bg-gray-50 text-gray-600 text-sm">
        No exam record found for this pharmacist.
      </div>
    );
  }

  const items = [
    {
      type: 'NAPLEX',
      label: `NAPLEX (${record.naplexVer === 'new_outline' ? 'New Outline' : 'Legacy'})`,
      link: record.evidenceUrls?.naplex_outline || 'https://nabp.pharmacy/programs/naplex/',
      timestamp: record.examDate
        ? new Date(record.examDate).toLocaleDateString()
        : 'Not specified',
    },
    {
      type: 'MPJE',
      label: `MPJE (${record.mpjeMode === 'uniform' ? 'Uniform' : 'State'})`,
      link: record.evidenceUrls?.mpje_state_law || 'https://nabp.pharmacy/programs/mpje/',
      timestamp: record.examDate
        ? new Date(record.examDate).toLocaleDateString()
        : 'Not specified',
    },
  ];

  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="flex items-center gap-2 mb-4">
        <FileText size={20} className="text-blue-600" />
        <h3 className="font-semibold text-gray-900">
          Pharmacist Licensure Evidence
        </h3>
      </div>

      {record.naplexVer === 'new_outline' && (
        <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800 flex items-center gap-1">
          <CheckCircle size={14} />
          <span>
            <strong>New NAPLEX Outline</strong> applies (effective May 1, 2025)
          </span>
        </div>
      )}

      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start justify-between py-2 border-b last:border-0">
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">{item.label}</div>
              <div className="text-xs text-gray-600 mt-0.5">
                {item.type} • {item.timestamp}
              </div>
            </div>
            <a
              href={item.link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-xs"
            >
              <span>View Source</span>
              <ExternalLink size={14} />
            </a>
          </div>
        ))}
      </div>

      {record.mpjeMode === 'uniform' && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          <strong>Note:</strong> Uniform MPJE adoption begins June 2026. State-by-state rollout varies.
        </div>
      )}
    </div>
  );
}

