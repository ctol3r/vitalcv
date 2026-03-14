import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion, AnimatePresence } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { ButtonPrimary } from '../../components/ui/ButtonPrimary';
import { ShieldCheck, ArrowUpRight, CheckCircle2 } from 'lucide-react';

const meta: Meta = {
  title: 'Wireframes/WidgetPopup',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const Interactive: StoryObj = {
  render: () => {
    return <HostApplicationDemo />;
  },
};

function HostApplicationDemo() {
  const [isWidgetOpen, setIsWidgetOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-slate-100 dark:bg-slate-900 font-sans p-6 md:p-12 overflow-hidden">
        {/* Mocking a Host Application (e.g., an ATS or Hospital Portal) */}
        <header className="flex justify-between items-center mb-12 opacity-50">
           <div className="text-2xl font-bold font-mono">Hospital ATS</div>
           <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="w-8 h-8 rounded-full bg-slate-300 dark:bg-slate-700" />
           </div>
        </header>

        <div className="max-w-4xl bg-white dark:bg-slate-800 p-8 rounded-xl opacity-80 grid gap-6">
           <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-700 rounded" />
           <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded" />
           <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded" />
           
           <div className="mt-8 border border-slate-200 dark:border-slate-700 rounded-lg p-6 flex justify-between items-center">
              <div>
                 <div className="font-semibold text-lg text-slate-800 dark:text-slate-100">Attach Verified Credentials</div>
                 <div className="text-sm text-slate-500">Provide trust-certified documentation instantly via VitalCV.</div>
              </div>
              <button 
                 onClick={() => setIsWidgetOpen(true)}
                 className="px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md font-medium hover:bg-slate-800 transition-colors"
               >
                 Verify with VitalCV
              </button>
           </div>
        </div>

        {/* The VitalCV Widget Overlay */}
        <AnimatePresence>
           {isWidgetOpen && (
              <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 exit={{ opacity: 0 }}
                 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
              >
                 <motion.div
                    initial={{ scale: 0.9, y: 30, opacity: 0 }}
                    animate={{ scale: 1, y: 0, opacity: 1 }}
                    exit={{ scale: 0.95, y: 10, opacity: 0 }}
                    transition={{ duration: durations.normal, ease: easings.easeOut }}
                    className="w-full max-w-md bg-background rounded-3xl overflow-hidden shadow-elevated border border-border flex flex-col"
                 >
                    {/* Header */}
                    <div className="p-6 border-b border-border flex justify-between items-center bg-card">
                       <div className="flex items-center gap-2 font-heading font-medium">
                          <ShieldCheck className="w-5 h-5 text-trustGreen" />
                          VitalCV Connect
                       </div>
                       <button 
                         onClick={() => setIsWidgetOpen(false)}
                         className="text-xs text-muted-foreground hover:text-foreground font-mono"
                       >
                          close [x]
                       </button>
                    </div>

                    {/* Content Body */}
                    <div className="p-8 flex flex-col gap-6 items-center text-center">
                       <ShieldCheck className="w-16 h-16 text-muted-foreground" />
                       
                       <h3 className="text-2xl font-heading font-semibold">Connect your passport</h3>
                       <p className="text-sm text-muted-foreground">
                          Instantly share your primary-source verified credentials with Hospital ATS.
                       </p>

                       <input 
                         type="text" 
                         placeholder="Enter your NPI"
                         className="w-full p-4 text-center text-2xl tracking-widest bg-transparent border-b-2 border-border focus:border-foreground focus:outline-none transition-colors mt-4" 
                       />

                       <ButtonPrimary className="w-full mt-4 py-4 rounded-xl shadow-glass flex justify-between items-center px-6">
                           <span>Authorize connection</span>
                           <ArrowUpRight className="w-5 h-5" />
                       </ButtonPrimary>
                    </div>

                    <div className="p-4 bg-card text-center text-xs text-muted-foreground flex items-center justify-center gap-1 border-t border-border">
                       <ShieldCheck className="w-3 h-3 text-trustGreen" />
                       End-to-end encrypted connection
                    </div>
                 </motion.div>
              </motion.div>
           )}
        </AnimatePresence>
    </div>
  );
}
