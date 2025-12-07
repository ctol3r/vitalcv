"use client";

import { useState } from "react";
import AgentAssistant from "../components/AgentAssistant";
import AgentHealth from "../components/AgentHealth";
import SloMini from "../components/SloMini";
import AnchorsPanel from "../components/AnchorsPanel";
import SelectiveDisclosureCard from "../components/SelectiveDisclosureCard";
import OidcIssuerBadge from "../components/OidcIssuerBadge";
import NpiLookup from "@/components/NpiLookup";
import DemoOverlay from "@/components/DemoOverlay";
import PerfHud from "../components/PerfHud"; // Round 10
import DlpNotice from "@/components/DlpNotice"; // Round 22

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function AgentPage() {
  const [demoResult, setDemoResult] = useState<any>(null);
  const [goliveChecklist, setGoliveChecklist] = useState<any>(null);

  async function runDemoScript() {
    const r = await fetch(BASE + '/demo/run', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subjectDid: 'did:key:zDemo' })
    });
    const result = await r.json();
    setDemoResult(result);
  }

  async function showGoLive() {
    const r = await fetch(BASE + '/golive');
    const result = await r.json();
    setGoliveChecklist(result);
  }
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-6 mb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Agent Console</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={runDemoScript}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              title="Run 5-min demo script"
            >
              Run Demo Script
            </button>
            <button
              onClick={showGoLive}
              className="text-sm px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
              title="Go-Live Checklist"
            >
              Go-Live
            </button>
            <a
              href="/docs/security-checklist"
              className="text-sm text-blue-600 hover:text-blue-800 underline"
              title="View security checklist"
            >
              Security Checklist
            </a>
            <AgentHealth />
          </div>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6">
        {demoResult && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Demo Script Result</h2>
            <pre className="text-[10px] bg-gray-50 p-2 rounded overflow-auto max-h-64">
              {JSON.stringify(demoResult, null, 2)}
            </pre>
          </div>
        )}
        {goliveChecklist && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-2">Go-Live Checklist</h2>
            <ul className="space-y-2">
              {Object.entries(goliveChecklist).map(([key, value]) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="font-mono text-sm">{value as string}</span>
                  <span className="text-gray-600">{key}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <AgentAssistant />
        <DlpNotice />
        <SloMini />
        <div className="mt-6 space-y-4">
          <OidcIssuerBadge />
          <PerfHud />
          <NpiLookup />
          <SelectiveDisclosureCard />
          <AnchorsPanel />
        </div>
      </div>
      {/* Round 15: Demo Overlay */}
      <DemoOverlay />
    </div>
  );
}
