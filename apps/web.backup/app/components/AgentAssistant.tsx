"use client";

import { useState } from "react";
import axios from "axios";
import AgentApprovalBanner from "./AgentApprovalBanner";
import { ErrorToast } from "./ErrorToast";

export default function AgentAssistant() {
  const [task, setTask] = useState("");
  const [input, setInput] = useState("{}");
  const [scopeHints, setScopeHints] = useState<string[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [streamMode, setStreamMode] = useState(false); // Round 10: streaming toggle

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);
    setShowAuthPrompt(false);

    try {
      const baseUrl =
        process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";

      // Get auth headers if token exists
      const headers: any = { 'Content-Type': 'application/json' };
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('vitalcv_jwt');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      // Round 10: Streaming mode support
      if (streamMode) {
        const url = `${baseUrl}/api/agent/solve?stream=1`;
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({ task, input: JSON.parse(input), scopeHints }),
        });

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        const events: any[] = [];

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(Boolean);

            for (const line of lines) {
              try {
                const event = JSON.parse(line);
                events.push(event);

                // Update result as events come in
                if (event.event === 'result') {
                  setResult({ ...event, success: event.success, events });
                }
              } catch (e) {
                console.warn('Failed to parse NDJSON line:', line);
              }
            }
          }
        }

        setResult({ success: true, events });
      } else {
        const { data } = await axios.post(`${baseUrl}/api/agent/solve`, {
          task,
          input: JSON.parse(input),
          scopeHints,
        }, { headers });

        setResult(data);
      }
    } catch (error: any) {
      // Check for auth required error
      if (error.response?.status === 401 && error.response?.data?.error === 'auth_required_for_sensitive') {
        setShowAuthPrompt(true);
        setError('This action requires authentication. Please provide a JWT token.');
      } else {
        setError(error.message || 'Request failed');
      }

      setResult({
        success: false,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (presetTask: string, presetInput: any, scopes: string[]) => {
    setTask(presetTask);
    setInput(JSON.stringify(presetInput, null, 2));
    setScopeHints(scopes);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Agent Assistant</h2>

      {/* Auth Prompt */}
      {showAuthPrompt && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="text-sm font-semibold text-yellow-800 mb-2">Authentication Required</h3>
          <p className="text-xs text-yellow-700 mb-3">This action requires a JWT token. Paste your token below:</p>
          <input
            type="text"
            className="w-full px-3 py-2 border border-yellow-300 rounded-md text-sm font-mono mb-2"
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
            onChange={(e) => {
              if (e.target.value) {
                localStorage.setItem('vitalcv_jwt', e.target.value);
              }
            }}
          />
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 text-sm"
          >
            Retry with Token
          </button>
        </div>
      )}

      {/* Presets */}
      <div className="mb-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Quick Presets:</div>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
            onClick={() =>
              loadPreset(
                "verify medical license",
                { state: "CA", licensePdfId: "file_demo" },
                ["license"]
              )
            }
          >
            Verify License
          </button>
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
            onClick={() =>
              loadPreset(
                "parse resume then suggest matching jobs",
                { resumeText: "Cardiologist with 10 years experience..." },
                ["matcher"]
              )
            }
          >
            Resume → Matches
          </button>
          <button
            className="px-3 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50"
            onClick={() =>
              loadPreset(
                "lookup NPI and verify credentials",
                { npi: "1234567890" },
                ["npi", "license"]
              )
            }
          >
            NPI Lookup
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Task Description
          </label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="e.g., verify medical license and match to jobs"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Input (JSON)
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={6}
            placeholder='{"npi": "1234567890"}'
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scope Hints (comma-separated)
          </label>
          <input
            type="text"
            value={scopeHints.join(", ")}
            onChange={(e) =>
              setScopeHints(
                e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
              )
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            placeholder="license, npi, matcher"
          />
        </div>

        {/* Round 10: Stream mode toggle */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="streamMode"
            checked={streamMode}
            onChange={(e) => setStreamMode(e.target.checked)}
            className="w-4 h-4"
          />
          <label htmlFor="streamMode" className="text-sm text-gray-700">
            Enable Streaming (NDJSON)
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Processing..." : "Execute Agent Task"}
        </button>
      </form>

      {result && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Result:</h3>

          {/* Trace ID & Picks */}
          {result.traceId && (
            <div className="mb-2 flex items-center gap-2 text-xs">
              <span className="font-medium">Trace:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">{result.traceId}</code>
              <button
                className="px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                onClick={() => navigator.clipboard.writeText(String(result.traceId || ''))}
              >
                Copy
              </button>
            </div>
          )}

          {Array.isArray(result.picks) && result.picks.length > 0 && (
            <div className="mb-2 text-xs">
              <span className="font-medium">Picks:</span> {result.picks.map((p: any) => p.name || p?.manifest?.name).filter(Boolean).join(', ')}
            </div>
          )}

          {/* Approval Gate Banner */}
          {result.needsApproval && result.traceId && result.mcp && (
            <div className="mb-4">
              <AgentApprovalBanner
                traceId={result.traceId}
                mcp={result.mcp}
              />
            </div>
          )}

          <div
            className={`p-4 rounded-lg ${
              result.success ? "bg-green-50" : result.needsApproval ? "bg-yellow-50" : "bg-red-50"
            }`}
          >
            <pre className="text-sm overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && <ErrorToast msg={error} />}
    </div>
  );
}
