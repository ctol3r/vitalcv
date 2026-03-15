"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Send, Network, Shield, ChevronRight } from 'lucide-react';
import { CopilotResultCard } from './CopilotResultCard';
import { CopilotInsightPanel } from './CopilotInsightPanel';

export function CopilotWorkspace() {
  const [query, setQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setHasSearched(true);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#03060A] text-white font-sans overflow-hidden">
      
      {/* LEFT COLUMN: Conversational Workspace */}
      <div className="flex-1 flex flex-col border-r border-white/10 relative">
        
        {/* Main Conversation Area */}
        <div className="flex-1 overflow-y-auto p-12 scrollbar-hide">
          <div className="max-w-4xl mx-auto space-y-12 pb-32">
            
            {/* Empty State / Welcome or Search Results */}
            {!hasSearched ? (
              <div className="flex flex-col items-center justify-center text-center mt-32 opacity-50 transition-opacity">
                <Sparkles className="w-12 h-12 text-blue-400 mb-6" />
                <h1 className="text-3xl font-light tracking-tight text-white/90">VitalCV Copilot</h1>
                <p className="text-white/50 text-lg mt-2">The command center for provider intelligence.</p>
              </div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8"
              >
                {/* User Query */}
                <div className="text-xl font-medium text-white/90 border-l-2 border-blue-500 pl-4 py-1">
                  {query || "Which oncologists in Texas have NIH funding?"}
                </div>
                
                {/* AI Text Response */}
                <div className="prose prose-invert prose-lg max-w-none text-white/70">
                  <p>I found several highly-funded oncologists matching your criteria in the Texas network. Analyzing existing grant relationships and institutional clustering...</p>
                </div>
                
                {/* Result Cards */}
                <div className="space-y-6">
                  <CopilotResultCard 
                    name="Dr. Sarah Chen" 
                    specialty="Oncologist, MD" 
                    institution="MD Anderson" 
                    location="Texas, USA" 
                    trustScore={99} 
                    evidenceCount={142} 
                    connectionsCount={89} 
                    status="verified" 
                  />
                  <CopilotResultCard 
                    name="Dr. Michael Ross" 
                    specialty="Pediatric Oncologist, MD" 
                    institution="Texas Children's Hospital" 
                    location="Texas, USA" 
                    trustScore={92} 
                    evidenceCount={84} 
                    connectionsCount={42} 
                    status="warning" 
                  />
                </div>
              </motion.div>
            )}

          </div>
        </div>

        {/* Global Copilot Search Bar (Fixed at Bottom of Main Column) */}
        <div className="absolute bottom-0 left-0 right-0 p-8 pt-24 bg-gradient-to-t from-[#03060A] via-[#03060A]/90 to-transparent pointer-events-none">
          <form onSubmit={handleSearch} className="max-w-4xl mx-auto relative group pointer-events-auto">
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
            <div className="relative flex items-center bg-[#0C121A] border border-white/10 rounded-2xl p-2 shadow-2xl backdrop-blur-xl">
              <div className="pl-4 pr-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about providers, networks, or evidence..."
                className="flex-1 bg-transparent border-none text-white/90 text-lg placeholder:text-white/30 focus:outline-none focus:ring-0 px-2 h-14"
              />
                <button type="submit" className="h-12 w-12 flex items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors duration-200 ml-2">
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            {/* Suggested Follow-ups */}
            <div className="flex gap-3 mt-4 overflow-x-auto scrollbar-hide py-2">
              {['Highest trust score neurologists', 'Search for recent medical board actions', 'Who is connected to Dr. Sarah Chen?'].map((suggestion, i) => (
                <button 
                  key={i} 
                  type="button" 
                  onClick={() => {
                    setQuery(suggestion);
                    setHasSearched(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-sm text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors whitespace-nowrap"
                >
                  <Search className="w-3 h-3" />
                  {suggestion}
                </button>
              ))}
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Graph Insight Panel */}
      <div className="w-[450px] shrink-0 border-l border-white/10">
        <CopilotInsightPanel />
      </div>
      
    </div>
  );
}
