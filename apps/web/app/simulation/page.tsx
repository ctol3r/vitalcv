export const metadata = {
  title: 'Antigravity Trust Simulation | VitalCV',
  description: 'Simulating the cryptographic trust propagation and revocation impact cascade.',
};

import { TrustSimulation } from '@/components/simulation/TrustSimulation';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function SimulationPage() {
  return (
    <div className={`min-h-screen bg-black text-slate-50 relative overflow-hidden flex flex-col items-center pt-24 pb-32 ${inter.className}`}>

      {/* Header */}
      <div className="z-10 text-center space-y-4 max-w-2xl px-6 mb-12">
         <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-sm font-medium tracking-wide">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
          Live Simulation
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Trust Propagation Cascade
        </h1>
        <p className="text-lg text-zinc-400">
          Visualize real-time cryptographic verification and the immediate impact of credential revocation across the healthcare network.
        </p>
      </div>

      {/* Orchestrator */}
      <div className="w-full px-4 md:px-12 z-10">
        <TrustSimulation />
      </div>

      {/* Decorative Grid */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
