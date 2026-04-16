"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, ShieldAlert, Database } from "lucide-react";

interface ReadinessPreviewProps {
  npi: string;
  onClick: () => void;
}

export default function ReadinessPreview({ npi, onClick }: ReadinessPreviewProps) {
  const isPlaceholder = !npi || npi.length !== 10;
  const displayNpi = isPlaceholder ? "1003000126" : npi;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Preview readiness check — continue to passport"
      className="mt-24 w-full border border-line p-8 bg-white/10 dark:bg-white/5 text-left relative group cursor-pointer hover:bg-white/20 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold tracking-tight">Check Readiness</h3>
            <span className="text-[8px] font-mono bg-amber-500/10 text-amber-600 px-1.5 py-0.5 border border-amber-500/20 uppercase tracking-tighter">
              Informational Only
            </span>
          </div>
          <p className="text-xs opacity-60 font-mono uppercase tracking-tight">
            {isPlaceholder ? "Identity Resolution Pending" : `NPI: ${displayNpi}`}
          </p>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest border border-line px-2 py-1 flex items-center gap-2">
          <Database className="w-3 h-3 opacity-40" />
          Public Record Check
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 opacity-60 font-mono">
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Identity</div>
          <div className="text-[10px] font-bold">CHECKED</div>
        </div>
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Sanctions</div>
          <div className="text-[10px] font-bold">CHECKED</div>
        </div>
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Licensure</div>
          <div className="text-[10px] font-bold">CHECKED</div>
        </div>
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Board Cert</div>
          <div className="text-[10px] font-bold text-amber-500">UNAVAILABLE</div>
        </div>
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">DEA Reg</div>
          <div className="text-[10px] font-bold text-amber-500">ACCESS REQ</div>
        </div>
        <div className="border border-line p-3 bg-white/10 dark:bg-white/5">
          <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Readiness</div>
          <div className="text-[10px] font-bold">84%</div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href="/passport"
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest group-hover:gap-4 transition-all cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Continue to Passport <ArrowRight className="w-3 h-3" />
        </Link>
        <div className="flex items-center gap-2 text-[8px] font-mono opacity-30 uppercase tracking-tighter">
          <ShieldAlert className="w-3 h-3" />
          No PII Transmitted in Preview Mode
        </div>
      </div>
    </div>
  );
}
