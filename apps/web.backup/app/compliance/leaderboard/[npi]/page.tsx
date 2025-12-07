"use client";
import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const SRCS = ['license', 'board', 'dea', 'npdb', 'oig', 'caqh', 'pecos'];

const RUN: Record<string, (npi: string) => Promise<void>> = {
  license: async (n) => {
    await fetch('/api/verify/run?source=license&npi=' + n, { method: 'POST' });
  },
  board: async (n) => {
    await fetch('/api/verify/board-cert?npi=' + n, { method: 'POST' });
  },
  dea: async (n) => {
    await fetch('/api/verify/dea?npi=' + n, { method: 'POST' });
  },
  npdb: async (n) => {
    await fetch('/api/verify/npdb?npi=' + n, { method: 'POST' });
  },
  oig: async (n) => {
    await fetch('/api/verify/oig?npi=' + n, { method: 'POST' });
  },
  caqh: async (n) => {
    await fetch('/api/verify/run?source=caqh&npi=' + n, { method: 'POST' });
  },
  pecos: async (n) => {
    await fetch('/api/verify/run?source=pecos&npi=' + n, { method: 'POST' });
  },
};

export default function Drill({ params }: { params: { npi: string } }) {
  const [rows, setRows] = useState<any[]>([]);
  const [downloading, setDownloading] = useState(false);

  async function load() {
    const r = await fetch('/api/compliance/leaderboard/' + params.npi);
    const js = await r.json();
    setRows(js.rows || []);
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * Download evidence packet for this clinician
   * FE-PSV-001: Evidence packet download button (per clinician)
   */
  async function downloadEvidencePacket() {
    setDownloading(true);
    try {
      // Call backend evidence export endpoint
      const response = await fetch(`/api/compliance/evidence/${params.npi}/export?format=json`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error_description: 'Failed to export evidence' }));
        throw new Error(error.error_description || 'Failed to export evidence');
      }

      const data = await response.json();

      // Create downloadable JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ncqa-evidence-${params.npi}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Evidence packet downloaded',
        description: `Evidence bundle for ${params.npi} downloaded successfully`,
      });
    } catch (error) {
      console.error('Evidence download error:', error);
      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download evidence packet',
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">PSV Drill-down — {params.npi}</h1>
        <Button
          onClick={downloadEvidencePacket}
          disabled={downloading}
          variant="outline"
          className="flex items-center gap-2"
        >
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Downloading...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Evidence Packet
            </>
          )}
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r: any, i: number) => (
          <div key={i} className="p-2 border rounded text-xs flex items-center justify-between">
            <div>
              <b>{r.source.toUpperCase()}</b> • {r.latest_at ? new Date(r.latest_at).toLocaleDateString() : '—'}
            </div>
            <div className={'px-2 py-0.5 rounded ' + (r.ok ? 'bg-green-100' : 'bg-red-100')}>
              {r.ok ? 'OK' : 'Overdue (' + (r.days_since ?? '?') + 'd)'}
            </div>
            <button
              className="px-2 py-1 border rounded"
              onClick={async () => {
                await RUN[r.source](params.npi);
                load();
              }}
            >
              Run
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
