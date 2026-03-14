import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { AntigravityHero } from '../../components/ui/AntigravityHero';
import { ButtonPrimary } from '../../components/ui/ButtonPrimary';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const meta: Meta = {
  title: 'Wireframes/Homepage',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;

export const HeroSection: StoryObj = {
  render: () => {
    return (
      <div className="relative min-h-screen w-full bg-background overflow-hidden flex flex-col items-center justify-center p-6 md:p-12">
        {/* Subtle motion background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[20%] left-[10%] w-[30%] h-[30%] bg-trustGreen/5 blur-[120px] rounded-full animate-glow-breathe" />
          <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-accent/5 blur-[150px] rounded-full animate-glow-breathe" style={{ animationDelay: '3s' }} />
        </div>

        {/* Navigation placeholder */}
        <header className="absolute top-0 left-0 right-0 p-8 flex justify-between items-center z-50">
           <div className="flex items-center gap-2 text-xl font-heading font-semibold">
              <ShieldCheck className="w-8 h-8 text-trustGreen" />
              VitalCV
           </div>
           <nav className="hidden md:flex gap-8 text-sm font-medium tracking-wide">
              <span className="text-foreground hover:opacity-70 cursor-pointer transition-opacity">Clinicians</span>
              <span className="text-foreground hover:opacity-70 cursor-pointer transition-opacity">Verifiers</span>
              <span className="text-foreground hover:opacity-70 cursor-pointer transition-opacity">How it works</span>
              <span className="text-foreground hover:opacity-70 cursor-pointer transition-opacity">Trust</span>
           </nav>
           <div className="flex gap-4">
              <button className="text-sm font-medium px-4 py-2 text-foreground hover:opacity-70 transition-opacity">Login</button>
              <ButtonPrimary className="text-sm px-6 py-2 rounded-full">Create profile</ButtonPrimary>
           </div>
        </header>

        {/* Hero Content */}
        <motion.div
           initial={{ opacity: 0, y: 30 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: durations.slow, ease: easings.easeOut }}
           className="w-full flex justify-center mt-[-10vh] max-w-7xl mx-auto"
        >
          <div className="flex flex-col items-center text-center gap-16 z-10 w-full">
            <AntigravityHero
              headline="Verify once. Use everywhere."
              headlineClassName="text-6xl md:text-[6rem] lg:text-[8rem] xl:text-11xl tracking-tighter w-full max-w-[90vw]"
              subhead="Create a verified clinician credential profile that stays ready and portable."
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: durations.normal }}
              className="flex flex-col md:flex-row gap-6 mt-12 w-full md:w-auto"
            >
              <ButtonPrimary className="text-xl px-12 py-8 rounded-full shadow-elevated bg-foreground text-background hover:bg-foreground/90 w-full md:w-auto">
                Create your credential profile
                <ArrowRight className="ml-2 w-6 h-6" />
              </ButtonPrimary>
              <button className="text-muted-foreground hover:text-foreground px-8 py-4 text-xl transition-colors w-full md:w-auto font-medium">
                See how it works
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  },
};
