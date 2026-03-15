"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Network, Sparkles, Shield, ChevronRight } from 'lucide-react';

export function CopilotInsightPanel() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="w-full h-full bg-[#080C13] flex flex-col border-l border-white/5 shadow-2xl overflow-hidden"
    >
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.01]">
        <h2 className="text-sm font-semibold tracking-widest text-white/50 uppercase">Analysis Engine</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse"></div>
          <span className="text-xs text-white/40">Graph Active</span>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
        
        {/* Graph Mini-Map Placeholder */}
        <div className="h-48 rounded-xl border border-white/10 bg-gradient-to-br from-blue-900/20 to-purple-900/20 relative overflow-hidden group">
          <div className="absolute inset-0 flex items-center justify-center">
            <Network className="w-12 h-12 text-white/20 group-hover:scale-110 transition-transform duration-500" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
          <div className="absolute bottom-3 left-3 text-xs font-medium text-white/50">Current Traversal: 84 Nodes</div>
        </div>
        
        {/* Section: High Influence Providers */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-blue-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            High Centrality Nodes
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Dr. Sarah Chen', centrality: 98, role: 'PI' },
              { name: 'Dr. Michael Ross', centrality: 84, role: 'Co-Author' },
              { name: 'Dr. Emily Wei', centrality: 72, role: 'Institution Lead' }
            ].map((node, i) => (
              <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-white/90 group-hover:text-blue-400 transition-colors">{node.name}</div>
                    <div className="text-xs text-white/40 mt-1">{node.role}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-blue-400 transition-colors" />
                    <span className="text-xs font-mono text-emerald-400/80">{node.centrality}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section: Research Clusters */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-purple-400 flex items-center gap-2">
            <Network className="w-4 h-4" />
            Identified Clusters
          </h3>
          <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Texas Med Center', count: 142, highlight: true },
                { label: 'MD Anderson', count: 89 },
                { label: 'NIH Grant #882', count: 12 },
                { label: 'Oncology Board', count: 4 }
              ].map((cluster, i) => (
                <span key={i} className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${cluster.highlight ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-white/5 text-white/60 border-white/10'}`}>
                  {cluster.label} <span className="opacity-50 ml-1">({cluster.count})</span>
                </span>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
