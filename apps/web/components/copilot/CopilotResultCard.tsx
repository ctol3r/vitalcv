"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Network, FileText, CheckCircle, AlertTriangle, Building2, MapPin, Search } from 'lucide-react';

interface ContentProp {
  name: string;
  specialty: string;
  trustScore: number;
  institution: string;
  location: string;
  evidenceCount: number;
  connectionsCount: number;
  status: 'verified' | 'warning' | 'review';
}

export function CopilotResultCard({ 
  name = "Example Clinician A", 
  specialty = "Oncologist, MD", 
  trustScore = 99, 
  institution = "MD Anderson", 
  location = "Texas, USA", 
  evidenceCount = 142, 
  connectionsCount = 89,
  status = 'verified'
}: Partial<ContentProp>) {
  
  const statusConfig = {
    verified: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    review: { icon: Search, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
  };
  
  const activeStatus = statusConfig[status];
  const StatusIcon = activeStatus.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl rounded-2xl bg-[#080C13] border border-white/5 overflow-hidden group shadow-2xl relative"
    >
      {/* Background ambient glow based on trust score */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-3xl rounded-full"></div>
      
      <div className="p-6 relative z-10">
        
        {/* Header section */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{name}</h2>
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${activeStatus.border} ${activeStatus.bg}`}>
                <StatusIcon className={`w-3.5 h-3.5 ${activeStatus.color}`} />
                <span className={`text-xs font-semibold tracking-wide ${activeStatus.color}`}>{trustScore}%</span>
              </div>
            </div>
            <p className="text-blue-400/80 font-medium tracking-wide flex items-center gap-2">
              {specialty}
              <span className="w-1 h-1 rounded-full bg-muted"></span>
              <span className="text-muted-foreground flex items-center gap-1"><Building2 className="w-3.5 h-3.5"/> {institution}</span>
              <span className="w-1 h-1 rounded-full bg-muted"></span>
              <span className="text-muted-foreground flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> {location}</span>
            </p>
          </div>
        </div>

        {/* Intelligence Data Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-foreground/80 font-medium">Verified Sources</div>
              <div className="text-sm text-muted-foreground mt-0.5">NPI, NIH, State Board</div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex items-center gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <Network className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-foreground/80 font-medium">Network Gravity</div>
              <div className="text-sm text-muted-foreground mt-0.5">{connectionsCount} High-value connections</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-2">
          <div className="flex gap-2 text-xs text-muted-foreground/60 hidden sm:flex">
             <span>{evidenceCount} Evidence Claims</span>
             <span>•</span>
             <span>Last verified 2h ago</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* View Graph */}
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium">
              <Network className="w-4 h-4" />
              View Graph
            </button>
            
            {/* View Evidence */}
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium">
              <Shield className="w-4 h-4" />
              Evidence
            </button>

            {/* View Claims (Primary) */}
            <button className="flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black hover:bg-white/90 transition-colors text-sm font-semibold shadow-lg shadow-white/10">
              <FileText className="w-4 h-4" />
              View Claims
            </button>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
