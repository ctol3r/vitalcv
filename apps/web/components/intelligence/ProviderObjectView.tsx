'use client';

import React from 'react';
import { Shield, BookOpen, AlertCircle, Network, Award, DollarSign, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export function ProviderObjectView() {
  return (
    <div className="min-h-screen bg-[#0D1117] text-slate-300 font-sans flex flex-col">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-50 bg-[#0D1117]/80 backdrop-blur-xl border-b border-white/10 px-8 py-4 flex items-start justify-between">
        <div className="flex items-center gap-6">
          {/* Identity */}
          <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-white/20 flex items-center justify-center text-xl font-bold text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]">
            RJ
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Dr. Robert Jenkins</h1>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm font-mono text-slate-400">NPI: 1092837465</span>
              <span className="px-2 py-0.5 rounded-full bg-vt-info/10 border border-vt-info/30 text-vt-info text-xs font-semibold tracking-wide">CA ⚕️</span>
              <span className="px-2 py-0.5 rounded-full bg-vt-info/10 border border-vt-info/30 text-vt-info text-xs font-semibold tracking-wide">NY ⚕️</span>
            </div>
          </div>
        </div>

        {/* Trust Score */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-slate-400 uppercase tracking-widest">Trust Score</div>
              <div className="text-xs text-slate-500">Highly Verified</div>
            </div>
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="32" cy="32" r="28" className="stroke-white/10" strokeWidth="4" fill="none" />
                <circle cx="32" cy="32" r="28" className="stroke-vt-success drop-shadow-[0_0_8px_rgba(0,230,118,0.8)]" strokeWidth="4" fill="none" strokeDasharray="175" strokeDashoffset="20" />
              </svg>
              <span className="absolute text-xl font-bold text-white">88</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Interface */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side: Structured Profile Data (Obsidian Style Matrix) */}
        <div className="w-1/2 border-r border-white/10 flex flex-col overflow-y-auto custom-scrollbar p-8 gap-8">
          
          {/* Active Storylines Banner */}
          <div className="p-4 rounded-xl bg-vt-warning/10 border border-vt-warning/30 flex items-start gap-4 backdrop-blur-sm">
            <AlertCircle className="w-5 h-5 text-vt-warning shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-vt-warning uppercase tracking-widest mb-1">Active Storyline Implication</h4>
              <p className="text-sm text-slate-300">
                Implicated in <span className="font-mono text-vt-warning px-1 py-0.5 bg-vt-warning/20 rounded cursor-pointer hover:bg-vt-warning/30">[[ST-8991]]</span> regarding unusually high Medicare billing patterns in partnership with <span className="text-vt-info cursor-pointer hover:underline">[[Mercy General]]</span>.
              </p>
            </div>
          </div>

          {/* Practice Patterns */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Practice Patterns
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">Procedural Volume vs Nat. Avg</div>
                  <div className="h-12 w-full flex items-end gap-1">
                    {[3, 5, 4, 8, 12, 15, 22, 18, 14].map((h, i) => (
                      <div key={i} className="flex-1 bg-vt-info/40 rounded-t-sm hover:bg-vt-info/80 transition-colors" style={{ height: `${h * 4}px` }} />
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="p-4">
                  <div className="text-xs text-slate-400 uppercase tracking-wider mb-2">High Risk Prescriptions</div>
                  <div className="text-3xl font-mono text-white">2.4x</div>
                  <div className="text-xs text-vt-destructive mt-1">Above baseline expectation</div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Publications & Trials */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Publications & Clinical Trials
            </h3>
            <div className="space-y-2 border-l-2 border-white/10 pl-4 ml-2">
              <div className="relative">
                <div className="absolute w-2 h-2 rounded-full bg-vt-info -left-[21px] top-1.5 shadow-[0_0_8px_currentColor]" />
                <div className="text-xs font-mono text-slate-500 mb-1">2025-08-12</div>
                <div className="text-sm text-white hover:text-vt-info cursor-pointer transition-colors">
                  "Efficacy of Novel Therapeutics in Advanced Heart Failure"
                </div>
                <div className="text-xs text-slate-400 mt-1">Co-authored with [[Dr. Alan Grant]], [[Dr. Ellie Sattler]]</div>
              </div>
              <div className="relative mt-6">
                <div className="absolute w-2 h-2 rounded-full bg-slate-600 -left-[21px] top-1.5" />
                <div className="text-xs font-mono text-slate-500 mb-1">2024-03-01</div>
                <div className="text-sm text-white hover:text-vt-info cursor-pointer transition-colors">
                  Phase III Clinical Trial: Cardiac Resynchronization
                </div>
                <div className="text-xs text-slate-400 mt-1">Sponsored by [[MedTech Innovations LLC]]</div>
              </div>
            </div>
          </section>

          {/* Payments */}
          <section>
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Open Payments
            </h3>
            <div className="bg-[#0a0a0f] border border-white/10 rounded-xl p-4 font-mono text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-500 border-b border-white/10">
                    <th className="pb-2 font-normal">Date</th>
                    <th className="pb-2 font-normal">Entity</th>
                    <th className="pb-2 font-normal text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr>
                    <td className="py-2">2025-01-14</td>
                    <td className="py-2 hover:text-white cursor-pointer transition-colors">[[Pfizer Inc]]</td>
                    <td className="py-2 text-right">$4,500.00</td>
                  </tr>
                  <tr>
                    <td className="py-2">2024-11-02</td>
                    <td className="py-2 hover:text-white cursor-pointer transition-colors">[[Medtronic]]</td>
                    <td className="py-2 text-right text-vt-warning font-bold drop-shadow-[0_0_5px_rgba(255,176,32,0.8)]">$12,050.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

        </div>

        {/* Right Side: Network Graph Placeholder */}
        <div className="w-1/2 bg-[#0a0a0f] relative flex flex-col">
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-md border border-white/10 text-xs font-mono text-slate-300">
            <Network className="w-4 h-4" /> First Degree Network
          </div>
          
          {/* Conceptual Node Graph Area */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:24px_24px]" />
            
            {/* Mocked Graph Elements */}
            <div className="relative w-full h-full">
              {/* Central Node */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-[#0D1117] border-2 border-vt-info shadow-[0_0_30px_rgba(0,229,255,0.3)] flex items-center justify-center z-20 hover:scale-110 transition-transform cursor-pointer">
                RJ
              </div>
              
              {/* Connected Nodes */}
              <div className="absolute top-1/4 left-1/4 w-12 h-12 rounded-lg bg-white/5 border border-slate-500 flex items-center justify-center text-xs text-slate-400 z-10 cursor-pointer hover:border-white transition-colors">
                MG
              </div>
              {/* Thick Edge */}
              <svg className="absolute inset-0 pointer-events-none z-0">
                <line x1="25%" y1="25%" x2="50%" y2="50%" stroke="rgba(255,255,255,0.3)" strokeWidth="4" />
                <line x1="75%" y1="30%" x2="50%" y2="50%" stroke="rgba(255,176,32,0.6)" strokeWidth="2" strokeDasharray="4 4" />
                <line x1="80%" y1="70%" x2="50%" y2="50%" stroke="rgba(0,229,255,0.2)" strokeWidth="1" />
              </svg>
              
              <div className="absolute top-[30%] left-[75%] w-10 h-10 rounded-full bg-vt-warning/20 border border-vt-warning flex items-center justify-center text-[10px] text-vt-warning z-10 cursor-pointer shadow-[0_0_15px_rgba(255,176,32,0.4)]">
                !
              </div>
              <div className="absolute top-[70%] left-[80%] w-12 h-12 rounded-full bg-white/5 border border-vt-info flex items-center justify-center text-xs text-vt-info z-10 cursor-pointer">
                AG
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
