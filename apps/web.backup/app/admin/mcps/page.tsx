"use client";

import { useEffect, useState } from "react";

interface McpTool {
  id: string;
  name: string;
  description: string;
  scope: string;
  reliabilityScore: number;
  usageCount: number;
  createdAt: string;
}

export default function McpsPage() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const fetchMcps = async () => {
    try {
      const res = await fetch("/api/_proxy_mcps");
      if (!res.ok) {
        throw new Error(`Failed to fetch MCPs: ${res.statusText}`);
      }
      const js = await res.json();
      setTools(js.tools || []);
    } catch (err: any) {
      console.error("Error fetching MCPs:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMcps();
  }, []);

  const runJob = async (job: string) => {
    setRunning(job);
    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";
      const res = await fetch(`${baseUrl}/api/agent/admin/${job}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        throw new Error(`Job failed: ${res.statusText}`);
      }

      alert(`Job "${job}" completed successfully`);
      await fetchMcps(); // Refresh
    } catch (err: any) {
      alert(`Job failed: ${err.message}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">MCP Tools</h2>
        <p className="text-sm text-gray-600 mt-1">
          Manage and monitor learned MCP patterns
        </p>
      </div>

      {/* Admin Actions */}
      <div className="mb-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Admin Actions
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => runJob("learn")}
            disabled={running !== null}
          >
            {running === "learn" ? "Running..." : "Learn from Traces"}
          </button>
          <button
            className="px-3 py-1.5 rounded text-xs font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
            onClick={() => runJob("dedupe")}
            disabled={running !== null}
          >
            {running === "dedupe" ? "Running..." : "Dedupe MCPs"}
          </button>
          <button
            className="px-3 py-1.5 rounded text-xs font-medium bg-orange-600 text-white hover:bg-orange-700 disabled:opacity-50"
            onClick={() => runJob("reliability/decay")}
            disabled={running !== null}
          >
            {running === "reliability/decay" ? "Running..." : "Decay Scores"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
          <div className="mt-2 text-sm text-gray-600">Loading MCPs...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {!loading && !error && tools.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-500">No MCPs found</div>
        </div>
      )}

      {!loading && !error && tools.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Reliability
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Usage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tools.map((tool) => (
                <tr key={tool.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {tool.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {tool.description}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {tool.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{
                            width: `${tool.reliabilityScore * 100}%`,
                          }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600">
                        {(tool.reliabilityScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {tool.usageCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

