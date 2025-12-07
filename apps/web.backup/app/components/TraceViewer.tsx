"use client";

import { useState } from "react";
import { sendFeedback } from "../lib/feedback";

interface Trace {
  id: string;
  task_type: string;
  input: any;
  steps: Array<{
    tool?: string;
    mcp?: string;
    input?: any;
    output?: any;
    durationMs?: number;
  }>;
  outcome: {
    success: boolean;
    result?: any;
    error?: string;
  };
  created_at: string;
}

interface TraceViewerProps {
  trace: Trace;
}

export default function TraceViewer({ trace }: TraceViewerProps) {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFeedback = async (helpful: boolean) => {
    if (loading || sent) return;

    setLoading(true);
    try {
      const usedMcps = (trace.steps || [])
        .map((s: any) => s.mcp || s.tool)
        .filter(Boolean);

      await sendFeedback(trace.id, helpful, usedMcps);
      setSent(true);
    } catch (error) {
      console.error("Failed to send feedback:", error);
      alert("Failed to send feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-medium text-gray-900">
            {trace.task_type}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {new Date(trace.created_at).toLocaleString()}
          </div>
        </div>
        <div>
          {trace.outcome.success ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Success
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
              ✗ Failed
            </span>
          )}
        </div>
      </div>

      {/* Steps */}
      {trace.steps && trace.steps.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-700 mb-2">
            Steps ({trace.steps.length}):
          </div>
          <div className="space-y-1">
            {trace.steps.map((step, idx) => (
              <div
                key={idx}
                className="text-xs bg-gray-50 p-2 rounded border border-gray-100"
              >
                <span className="font-mono text-blue-600">
                  {step.mcp || step.tool || "unknown"}
                </span>
                {step.durationMs && (
                  <span className="text-gray-500 ml-2">
                    ({step.durationMs}ms)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Details (collapsible) */}
      <details className="mb-3">
        <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
          View Full Trace
        </summary>
        <pre className="text-xs bg-gray-50 p-3 mt-2 rounded overflow-auto max-h-96 border border-gray-200">
          {JSON.stringify(trace, null, 2)}
        </pre>
      </details>

      {/* Feedback */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {!sent ? (
          <>
            <button
              className="px-3 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleFeedback(true)}
              disabled={loading}
            >
              👍 Helpful
            </button>
            <button
              className="px-3 py-1.5 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => handleFeedback(false)}
              disabled={loading}
            >
              👎 Not helpful
            </button>
          </>
        ) : (
          <span className="text-xs text-gray-600 italic">
            Thanks for your feedback!
          </span>
        )}
      </div>
    </div>
  );
}
