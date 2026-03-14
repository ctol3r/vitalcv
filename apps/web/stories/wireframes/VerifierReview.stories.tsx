import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { ShieldCheck, CheckCircle2, Clock, AlertTriangle, ChevronRight, Download } from 'lucide-react';
import { BadgeStatus } from '../../components/ui/BadgeStatus';

const meta: Meta = {
  title: 'Wireframes/VerifierReview',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const DetailView: StoryObj = {
  render: () => {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
        {/* Verifier Header Strip */}
        <header className="h-16 border-b border-border flex items-center justify-between px-6 shrink-0 bg-card">
           <div className="flex items-center gap-4 text-sm">
             <span className="font-heading font-medium">Readiness Queue</span>
             <ChevronRight className="w-4 h-4 text-muted-foreground" />
             <span className="text-muted-foreground">Jane Doe, MD</span>
           </div>
           <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground flex items-center gap-1"><Clock className="w-4 h-4" /> Updated 2m ago</span>
              <button className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2">
                 <Download className="w-4 h-4" /> Export Report
              </button>
           </div>
        </header>

        {/* Main Content Area (Split Pane) */}
        <div className="flex-grow flex overflow-hidden">
           
           {/* Left Pane - Profile Context */}
           <motion.div 
             initial={{ opacity: 0, x: -20 }}
             animate={{ opacity: 1, x: 0 }}
             transition={{ duration: durations.fast }}
             className="w-1/3 min-w-[320px] max-w-[400px] border-r border-border p-8 overflow-y-auto bg-card space-y-8"
           >
              <div>
                 <h1 className="text-3xl font-heading font-medium tracking-tight">Dr. Jane Doe</h1>
                 <p className="text-muted-foreground text-lg mb-4">Internal Medicine</p>
                 <BadgeStatus status="L3" label="Ready to Board" />
              </div>

              <div className="h-px bg-border w-full" />

              <div className="space-y-4">
                 <div className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Identity & Core</div>
                 <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                    <span className="text-muted-foreground">NPI</span>
                    <span className="font-mono">1234567890</span>
                    
                    <span className="text-muted-foreground">DOB</span>
                    <span>10/12/1985</span>

                    <span className="text-muted-foreground">SSN</span>
                    <span className="font-mono">***-**-1234</span>
                 </div>
              </div>

               <div className="h-px bg-border w-full" />

              <div className="space-y-4">
                 <div className="text-sm font-medium uppercase tracking-widest text-muted-foreground">Clearance Signals</div>
                 
                 <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3 p-3 bg-background rounded-xl border border-border">
                       <CheckCircle2 className="w-5 h-5 text-trustGreen mt-0.5 shrink-0" />
                       <div className="text-sm">
                          <div className="font-medium">OIG Exclusion List</div>
                          <div className="text-muted-foreground">Cleared against all federal databases.</div>
                       </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-background rounded-xl border border-border">
                       <CheckCircle2 className="w-5 h-5 text-trustGreen mt-0.5 shrink-0" />
                       <div className="text-sm">
                          <div className="font-medium">NPDB Check</div>
                          <div className="text-muted-foreground">No adverse actions reported.</div>
                       </div>
                    </div>
                 </div>
              </div>
           </motion.div>

           {/* Right Pane - Primary Source Attestations */}
           <motion.div 
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.1, duration: durations.normal }}
             className="flex-grow p-8 overflow-y-auto bg-background"
           >
              <h2 className="text-2xl font-heading font-medium mb-8">Verified Credentials</h2>

              <div className="space-y-6 max-w-4xl">
                 
                 {/* Item 1 */}
                 <div className="glass border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 flex justify-between items-center border-b border-border bg-card">
                       <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-trustGreen" />
                          <span className="font-semibold">State Medical License (CA)</span>
                       </div>
                       <BadgeStatus status="L3" label="Primary Source Verified" />
                    </div>
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                       <div>
                          <div className="text-muted-foreground mb-1">License No.</div>
                          <div className="font-mono">A123456</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Issue Date</div>
                          <div>05/15/2018</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Expiration</div>
                          <div>05/31/2026</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Status</div>
                          <div className="text-trustGreen font-medium">Active - No Restrictions</div>
                       </div>
                    </div>
                 </div>

                 {/* Item 2 */}
                 <div className="glass border border-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 flex justify-between items-center border-b border-border bg-card">
                       <div className="flex items-center gap-3">
                          <ShieldCheck className="w-5 h-5 text-trustGreen" />
                          <span className="font-semibold">DEA Registration</span>
                       </div>
                       <BadgeStatus status="L3" label="Primary Source Verified" />
                    </div>
                    <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                       <div>
                          <div className="text-muted-foreground mb-1">Reg No.</div>
                          <div className="font-mono">XX1234567</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Schedules</div>
                          <div className="font-mono">2, 2N, 3, 3N, 4, 5</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Expiration</div>
                          <div>12/31/2025</div>
                       </div>
                       <div>
                          <div className="text-muted-foreground mb-1">Status</div>
                          <div className="text-trustGreen font-medium">Active</div>
                       </div>
                    </div>
                 </div>

                 {/* Simulated Missing Item */}
                 <div className="bg-muted/30 border border-dashed border-border rounded-2xl p-6 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground">
                           <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                           <div className="font-medium text-foreground">Board Certification (ABIM)</div>
                           <div className="text-sm text-muted-foreground mt-1">Pending attestation completion from primary source.</div>
                        </div>
                     </div>
                     <button className="text-sm font-medium px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors">
                        Ping Source
                     </button>
                 </div>

              </div>
           </motion.div>
        </div>
      </div>
    );
  },
};
