'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ZoomIn, ZoomOut, Maximize, Layers, SlidersHorizontal, Share2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GraphExplorationPanel() {
  const [zoomLevel, setZoomLevel] = useState<'macro' | 'meso' | 'micro'>('meso');
  const [focusedNode, setFocusedNode] = useState<string | null>(null);

  // Mock semantic zoom handler
  const toggleZoom = () => {
    if (zoomLevel === 'macro') setZoomLevel('meso');
    else if (zoomLevel === 'meso') setZoomLevel('micro');
    else setZoomLevel('macro');
  };

  return (
    <div className="relative w-full h-screen bg-[#000000] overflow-hidden text-slate-300 font-sans selection:bg-vt-info/30">
      
      {/* Background Canvas Grid */}
      <div 
        className={cn(
          "absolute inset-0 transition-transform duration-700 ease-in-out",
          zoomLevel === 'macro' ? 'scale-50 opacity-50' : 
          zoomLevel === 'micro' ? 'scale-150 opacity-100' : 'scale-100 opacity-80'
        )}
        style={{
          backgroundImage: 'radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      {/* Floating Header */}
      <div className="absolute top-6 left-6 z-40 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl p-4 w-80 shadow-2xl">
        <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
          <Share2 className="w-5 h-5 text-vt-info" /> Network Explorer
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search nodes, clusters..." 
            className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-vt-info transition-colors"
          />
        </div>
      </div>

      {/* The Graph Visualizations */}
      <div 
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          focusedNode ? "opacity-50" : "opacity-100" // Dim non-focused areas
        )}
      >
        {/* Cluster Visualization (Convex Hulls) */}
        <AnimatePresence>
          {zoomLevel !== 'micro' && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none"
            >
              <div className="absolute top-[20%] left-[20%] w-[30%] h-[40%] bg-vt-info/5 rounded-[40%_60%_70%_30%/40%_50%_60%_50%] mix-blend-screen blur-3xl animate-[pulse_10s_ease-in-out_infinite]" />
              <div className="absolute top-[40%] left-[50%] w-[25%] h-[35%] bg-vt-warning/5 rounded-[60%_40%_30%_70%/50%_40%_50%_60%] mix-blend-screen blur-3xl animate-[pulse_12s_ease-in-out_infinite_reverse]" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edges & Nodes Container */}
        <div className="relative w-full h-full flex items-center justify-center">
          <svg className="absolute inset-0 pointer-events-none">
            {/* Relationship Strength Encoding via Stroke Width & Opacity */}
            <line x1="40%" y1="40%" x2="50%" y2="50%" stroke="rgba(0,229,255,0.4)" strokeWidth="6" strokeLinecap="round" className="animate-[pulse_3s_ease-in-out_infinite]" />
            <line x1="60%" y1="35%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4" />
            <line x1="55%" y1="65%" x2="50%" y2="50%" stroke="rgba(255,176,32,0.8)" strokeWidth="3" />
            <line x1="25%" y1="60%" x2="40%" y2="40%" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
          </svg>

          {/* Center Hub Node */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            onMouseEnter={() => setFocusedNode('hub')}
            onMouseLeave={() => setFocusedNode(null)}
          >
            <div className={cn(
              "w-16 h-16 rounded-full bg-[#0D1117] border-2 flex items-center justify-center transition-all duration-300 cursor-pointer",
              focusedNode === 'hub' ? "border-vt-info shadow-[0_0_40px_rgba(0,229,255,0.6)] scale-110 z-50" : "border-white/20 hover:border-white/50 z-20"
            )}>
              <span className="font-bold text-white">Hub</span>
            </div>
            {zoomLevel === 'micro' && (
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur border border-white/10 p-2 rounded text-xs whitespace-nowrap z-50">
                <div className="text-white font-bold">Mercy General</div>
                <div className="text-slate-400">ID: FAC-0041 • Score: 92</div>
              </div>
            )}
          </div>

          {/* Periphery Nodes */}
          {[
            { id: '1', top: '40%', left: '40%', type: 'provider', label: 'Dr. Jenkins' },
            { id: '2', top: '35%', left: '60%', type: 'claim', label: 'Claim #8821', alert: false },
            { id: '3', top: '65%', left: '55%', type: 'provider', label: 'Dr. Vance', alert: true },
            { id: '4', top: '60%', left: '25%', type: 'institution', label: 'St. Judes' }
          ].map((node) => (
            <div 
              key={node.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ top: node.top, left: node.left }}
              onMouseEnter={() => setFocusedNode(node.id)}
              onMouseLeave={() => setFocusedNode(null)}
            >
              <div className={cn(
                "flex flex-col items-center justify-center transition-all duration-300 cursor-pointer",
                focusedNode === node.id || focusedNode === 'hub' ? "z-50 scale-110" : "z-10",
                node.type === 'provider' ? "w-12 h-12 rounded-full" : 
                node.type === 'institution' ? "w-12 h-12 rounded-lg" : 
                "w-10 h-10 rotate-45", // Diamond for claim
                "bg-[#0D1117] border border-white/20 hover:border-vt-info",
                node.alert && "border-vt-warning shadow-[0_0_20px_rgba(255,176,32,0.4)]"
              )}>
                <span className={cn(
                  "text-xs font-bold",
                  node.type === 'claim' && "-rotate-45",
                  node.alert ? "text-vt-warning" : "text-white/80"
                )}>
                  {node.type === 'claim' ? <DollarSign className="w-4 h-4" /> : node.label.substring(0,2)}
                </span>
              </div>
              
              {/* Semantic Labels */}
              {(zoomLevel === 'micro' || zoomLevel === 'meso') && (
                <div className={cn(
                  "absolute top-full mt-2 whitespace-nowrap text-xs transition-opacity",
                  focusedNode === node.id ? "opacity-100 font-bold text-white z-50" : "opacity-60 text-slate-400"
                )}>
                  {node.label}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Control Dock (Bottom Center) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-2 border-r border-white/10 pr-6">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white group relative">
            <ZoomOut className="w-5 h-5" />
          </button>
          <button onClick={toggleZoom} className="px-4 py-1.5 hover:bg-white/10 rounded-full transition-colors font-mono text-sm text-vt-info font-bold uppercase tracking-wider">
            {zoomLevel}
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white ml-2">
            <Maximize className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
            <Layers className="w-4 h-4" /> Layouts
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white flex items-center gap-2 text-xs font-bold uppercase tracking-wide border-l border-white/10 pl-4">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </button>
        </div>
      </div>

    </div>
  );
}
