"use client";

import { useState } from "react";
import { motion } from "framer-motion";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const DEMO_SD_JWT =
  "eyJhbGciOiJFUzI1NiIsInR5cCI6InZjK3NkLWp3dCJ9.eyJpc3MiOiJkaWQ6d2ViOmlzc3Vlci52aXRhbGN2LmNvbSIsInN1YiI6ImRpZDprZXk6ejZNa2hhWGdCWkR2b3REa0w1MjU3ZmFpenRpR2lDMlF0S0xHcGJubkVHdGEyZG9LIiwidmN0IjoiTWVkaWNhbExpY2Vuc2UiLCJpYXQiOjE3MDY3NDU2MDAsImV4cCI6MTc2OTgxNzYwMCwiaG9sZGVyTmFtZSI6IkRyLiBTYXJhaCBDaGVuIiwibGljZW5zZU51bWJlciI6IkEtMTQyODU3IiwibnBpIjoiMTAwMzAwMDEyNiIsInNjb3BlIjoiTWVkaWNpbmUgYW5kIFN1cmdlcnkiLCJzdGF0dXMiOiJ2YWxpZCIsInRydXN0TGV2ZWwiOiJMMyIsIm1ldGhvZG9sb2d5VmVyc2lvbiI6IjIuMS4wIiwicmF3U25hcHNob3RIYXNoIjoiZTNiMGM0NDI5OGZjMWMxNDlhZmJmNGM4OTk2ZmI5MjQyN2FlNDFlNDY0OWI5MzRjYTQ5NTk5MWI3ODUyYjg1NSIsInZlcmlmaWVyRElEIjoiZGlkOndlYjp2ZXJpZnkudml0YWxjdi5jb20iLCJfc2QiOlsiV3lKellXeDBNU0lzSW14cFkyVnVjMlZPZFcxaVpYSWlMQ0pCTFRFME1qZzFOeUpkIiwiV3lKellXeDBNaUlzSW01d2FTSXNJakV3TURNd01EQXhNallpWFEiXX0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA~WyJzYWx0MSIsImxpY2Vuc2VOdW1iZXIiLCJBLTE0Mjg1NyJd~WyJzYWx0MiIsIm5waSIsIjEwMDMwMDAxMjYiXQ~";

interface DevSimulatorProps {
  sessionId: string;
}

export function DevSimulator({ sessionId }: DevSimulatorProps) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );

  async function handleSimulate() {
    if (!sessionId || state === "sending") return;
    setState("sending");
    try {
      const res = await fetch(
        `${API_BASE}/api/verifier/submit-response/${sessionId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vp_token: DEMO_SD_JWT }),
        },
      );
      if (res.ok) setState("sent");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  const buttonText: Record<typeof state, string> = {
    idle: "Simulate Clinician Wallet Scan",
    sending: "Sending\u2026",
    sent: "\u2713 Scan simulated",
    error: "Error \u2014 retry",
  };

  return (
    <div className="border-t border-gray-200 pt-6">
      <p className="mb-3 text-sm uppercase tracking-wider text-gray-400">
        Developer Tools
      </p>
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleSimulate}
        disabled={state === "sending" || !sessionId}
        className="min-h-[44px] rounded-xl bg-gray-100 px-6 text-lg font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50"
      >
        {buttonText[state]}
      </motion.button>
    </div>
  );
}
