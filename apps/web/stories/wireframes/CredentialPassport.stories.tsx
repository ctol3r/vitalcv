import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { ProfileSummaryCard } from '../../components/ui/ProfileSummaryCard';
import { ButtonPrimary } from '../../components/ui/ButtonPrimary';
import { Download, ShieldCheck, Mail, MapPin, Building2 } from 'lucide-react';

const meta: Meta = {
  title: 'Wireframes/CredentialPassport',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const Concept: StoryObj = {
  render: () => {
    return (
      <div className="min-h-screen bg-background font-sans p-6 md:p-12 overflow-x-hidden pt-24">
         {/* Background Glow */}
         <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[50vh] bg-trustGreen/5 blur-[100px] rounded-full pointer-events-none -z-10" />

         <div className="max-w-5xl mx-auto flex flex-col gap-12">
            
            {/* Header Action Bar */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: durations.fast }}
              className="flex justify-between items-center glass p-4 rounded-full px-6 sticky top-6 z-50 shadow-glass"
            >
               <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="w-5 h-5 text-trustGreen" />
                  Verified Passport
               </div>
               <div className="flex gap-3">
                  <ButtonPrimary className="text-sm px-6 py-2 rounded-full">
                     <Download className="w-4 h-4 mr-2" />
                     Download PDF
                  </ButtonPrimary>
               </div>
            </motion.div>

            {/* Profile Overview (Apple Simplicity) */}
            <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               transition={{ delay: 0.1, duration: durations.normal, ease: easings.easeOut }}
               className="w-full"
            >
               <ProfileSummaryCard
                 npi="1234567890"
                 name="Jane Doe, MD"
                 specialty="Cardiology"
                 location="California Medical Board"
                 verifiedStatus="L3"
               />
            </motion.div>

            {/* Credential Data Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
               
               {/* Left Column: Licenses */}
               <motion.div
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.3, duration: durations.normal }}
                 className="flex flex-col gap-6"
               >
                  <h3 className="text-xl font-heading font-medium tracking-tight px-2">Active Licenses</h3>
                  
                  {[1, 2].map((i) => (
                    <div key={i} className="glass-heavy p-6 rounded-3xl flex flex-col gap-4 border border-border hover:shadow-elevated transition-shadow">
                       <div className="flex justify-between items-start">
                          <div>
                            <div className="text-lg font-medium">State Medical License</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                               <MapPin className="w-3 h-3" /> California Medical Board
                            </div>
                          </div>
                          <div className="px-3 py-1 bg-trustGreen/10 text-trustGreen text-xs font-semibold uppercase tracking-widest rounded-full">
                             Active
                          </div>
                       </div>
                       <div className="h-px w-full bg-border" />
                       <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-muted-foreground">License No.</div>
                            <div className="font-mono mt-1 text-foreground">A123456</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground">Expires</div>
                            <div className="font-mono mt-1 text-foreground">10/31/2026</div>
                          </div>
                       </div>
                    </div>
                  ))}
               </motion.div>

               {/* Right Column: Work History & Education */}
               <motion.div
                 initial={{ opacity: 0, x: 20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 0.4, duration: durations.normal }}
                 className="flex flex-col gap-6"
               >
                  <h3 className="text-xl font-heading font-medium tracking-tight px-2">Affiliations</h3>
                  
                  <div className="glass-heavy p-6 rounded-3xl flex flex-col gap-4 border border-border">
                     <div className="flex justify-between items-start">
                        <div>
                           <div className="text-lg font-medium">UCSF Medical Center</div>
                           <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                              <Building2 className="w-3 h-3" /> Attending Physician
                           </div>
                        </div>
                     </div>
                     <div className="text-sm text-muted-foreground">Aug 2018 — Present</div>
                  </div>

                  <h3 className="text-xl font-heading font-medium tracking-tight px-2 mt-4">Contact</h3>
                  <div className="glass-heavy p-6 rounded-3xl flex flex-col gap-4 border border-border">
                     <div className="flex items-center gap-3 text-foreground">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                           <Mail className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <span className="font-mono">dr.jane.doe@example.com</span>
                     </div>
                  </div>
               </motion.div>

            </div>
         </div>
      </div>
    );
  },
};
