import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { Search, Filter, ShieldCheck, MoreVertical } from 'lucide-react';
import { BadgeStatus } from '../../components/ui/BadgeStatus';

const meta: Meta = {
  title: 'Wireframes/ReadinessDashboard',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const Concept: StoryObj = {
  render: () => {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-12">
        <header className="flex justify-between items-end mb-12">
           <div>
              <h1 className="text-4xl md:text-5xl font-heading tracking-tight">Clinician Readiness</h1>
              <p className="text-lg text-muted-foreground mt-2">Palantir-scale data density. Stripe-scale clarity.</p>
           </div>
           
           <div className="flex gap-4">
              <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                 <input 
                   type="text" 
                   placeholder="Search clinicians..." 
                   className="pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring w-64"
                 />
              </div>
              <button className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors">
                 <Filter className="w-4 h-4" /> Filters
              </button>
           </div>
        </header>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: durations.normal, ease: easings.easeOut }}
           className="w-full glass border border-border rounded-3xl overflow-hidden shadow-sm"
        >
           {/* Table Header */}
           <div className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-border bg-muted/30 text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              <div className="pl-4">Status</div>
              <div>Clinician Provider</div>
              <div>NPI Number</div>
              <div>Specialty</div>
              <div>Primary State</div>
              <div className="pr-4">Actions</div>
           </div>

           {/* Table Rows */}
           {[...Array(6)].map((_, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, x: -10 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: i * 0.05, duration: durations.fast }}
               className="grid grid-cols-[auto_2fr_1fr_1fr_1fr_auto] gap-4 p-4 border-b border-border/50 hover:bg-muted/10 items-center transition-colors group cursor-pointer"
             >
                <div className="pl-4">
                   <div className="w-2 h-2 rounded-full bg-trustGreen" />
                </div>
                <div>
                  <div className="font-medium">Dr. Jane Doe</div>
                  <div className="text-sm text-muted-foreground">MD • Verified via State Board</div>
                </div>
                <div className="font-mono text-sm text-muted-foreground">1234567890</div>
                <div className="text-sm">Cardiology</div>
                <div className="text-sm"><BadgeStatus status="L3" label="California" /></div>
                <div className="pr-4 opacity-0 group-hover:opacity-100 transition-opacity">
                   <button className="p-2 hover:bg-muted rounded-lg text-muted-foreground"><MoreVertical className="w-4 h-4" /></button>
                </div>
             </motion.div>
           ))}
        </motion.div>
      </div>
    );
  },
};
