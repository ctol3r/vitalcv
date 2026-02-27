"use client";

import { useState } from "react";

import { DevSimulator } from "@/components/verifier/DevSimulator";
import { ScanTerminal } from "@/components/verifier/ScanTerminal";
import { VerifierCommandCenter } from "@/components/employer/VerifierCommandCenter";

export default function VerifierPage() {
  const [sessionId, setSessionId] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-slate-100">
      {/* Live Credential Intake section */}
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Live Credential Intake
        </h1>
        <p className="text-lg text-gray-600 mt-2">
          Scan a VitalCV credential to verify in real time
        </p>

        <div className="mt-8">
          <ScanTerminal onSessionReady={setSessionId} />
        </div>

        {/* Dev tools — discreet, bottom of scan section */}
        <div className="mt-8">
          <DevSimulator sessionId={sessionId} />
        </div>
      </div>

      {/* Existing verifier command center below */}
      <div className="border-t border-gray-200 mt-4">
        <VerifierCommandCenter />
      </div>
    </div>
  );
}
