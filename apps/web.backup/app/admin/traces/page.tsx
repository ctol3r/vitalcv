"use client";

import { useEffect, useState } from "react";
import TraceViewer from "@/app/components/TraceViewer";

export default function TracesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/_proxy_traces");
        if (!res.ok) {
          throw new Error(`Failed to fetch traces: ${res.statusText}`);
        }
        const js = await res.json();
        setRows(js.rows || []);
      } catch (err: any) {
        console.error("Error fetching traces:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          Recent Agent Traces
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          View and provide feedback on recent agent executions
        </p>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <div className="mt-2 text-sm text-gray-600">Loading traces...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-500">No traces found</div>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((trace: any) => (
            <TraceViewer key={trace.id} trace={trace} />
          ))}
        </div>
      )}
    </div>
  );
}
