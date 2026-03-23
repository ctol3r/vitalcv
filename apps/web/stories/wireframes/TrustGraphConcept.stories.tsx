import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { ShieldCheck, Activity, Users, Database } from 'lucide-react';

const meta: Meta = {
  title: 'Wireframes/TrustGraphConcept',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const Concept: StoryObj = {
  render: () => {
    return (
      <div className="relative min-h-screen w-full bg-background overflow-hidden p-6 md:p-12 font-sans text-foreground">
        
        <header className="mb-16 z-20 relative">
          <h1 className="text-4xl md:text-6xl font-heading tracking-tight">Trust Graph Engine</h1>
          <p className="text-xl text-muted-foreground mt-2 max-w-2xl font-light">
             Automated attestation routing across the VitalCV verified clinician network.
          </p>
        </header>

        {/* Abstract Data Visualization */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           {/* Center Node (VitalCV Core) */}
           <motion.div 
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             transition={{ duration: durations.slow, ease: easings.spring }}
             className="absolute w-32 h-32 rounded-full border border-trustGreen/30 bg-trustGreen/5 backdrop-blur-3xl flex items-center justify-center shadow-glow z-10"
           >
              <ShieldCheck className="w-12 h-12 text-trustGreen" />
           </motion.div>

           {/* Orbiting Satellite Nodes */}
           {[
             { icon: Activity, delay: 0.2, pos: 'top-[20%] left-[30%]' },
             { icon: Users, delay: 0.4, pos: 'top-[30%] right-[25%]' },
             { icon: Database, delay: 0.6, pos: 'bottom-[25%] left-[25%]' },
             { icon: ShieldCheck, delay: 0.8, pos: 'bottom-[30%] right-[30%]' },
           ].map((node, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, scale: 0 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: node.delay, duration: durations.slow, ease: easings.spring }}
               className={`absolute ${node.pos} w-16 h-16 rounded-full glass border-border flex items-center justify-center text-muted-foreground shadow-glass`}
             >
               <node.icon className="w-6 h-6" />

               {/* Connecting Pulse Lines (Simulated with absolute positioned divs) */}
               <motion.div 
                 initial={{ opacity: 0 }}
                 animate={{ opacity: [0, 0.5, 0] }}
                 transition={{ delay: node.delay + 1, duration: 2, repeat: Infinity, repeatDelay: 1 }}
                 className="absolute inset-0 border border-primary rounded-full zoom-out-pulse scale-150"
               />
             </motion.div>
           ))}
        </div>

        {/* Telemetry Overlay panel */}
        <motion.div
           initial={{ opacity: 0, x: -40 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ delay: 0.5, duration: durations.normal }}
           className="absolute bottom-12 left-12 w-80 p-6 glass-heavy rounded-3xl"
        >
          <div className="flex justify-between items-center mb-6">
             <div className="font-medium text-sm tracking-widest uppercase text-muted-foreground">Network Telemetry</div>
             <div className="w-2 h-2 rounded-full bg-trustGreen animate-pulse" />
          </div>
          
          <div className="space-y-6">
             <div>
                <div className="text-3xl font-heading font-semibold">1.4M+</div>
                <div className="text-sm text-muted-foreground">Verified Clinicians</div>
             </div>
             <div className="h-px bg-border w-full" />
             <div>
                <div className="text-3xl font-heading font-semibold">12ms</div>
                <div className="text-sm text-muted-foreground">Graph Attestation Latency</div>
             </div>
             <div className="h-px bg-border w-full" />
             <div>
                <div className="text-3xl font-heading font-semibold text-trustGreen">100%</div>
                <div className="text-sm text-muted-foreground">Primary Source Uptime</div>
             </div>
          </div>
        </motion.div>

      </div>
    );
  },
};
