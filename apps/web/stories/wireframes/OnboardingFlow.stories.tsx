import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { motion, AnimatePresence } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { AntigravityHero } from '../../components/ui/AntigravityHero';
import { ProgressiveTrustInput } from '../../components/ui/ProgressiveTrustInput';
import { ProfileSummaryCard } from '../../components/ui/ProfileSummaryCard';
import { ButtonPrimary } from '../../components/ui/ButtonPrimary';
import { CheckCircle2, Share2, ShieldCheck, ArrowRight } from 'lucide-react';

const meta: Meta = {
  title: 'Wireframes/OnboardingFlow',
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

export const FullFlow: StoryObj = {
  render: () => {
    return <OnboardingWizard />;
  },
};

// ── Wizard State Machine ───────────────────────────────────────────

type Step = 'NPI' | 'CONFIRM' | 'PREFILL' | 'READY' | 'SHARE';

function OnboardingWizard() {
  const [step, setStep] = useState<Step>('NPI');

  const advanceTo = (nextStep: Step, delayMs = 0) => {
    setTimeout(() => {
      setStep(nextStep);
    }, delayMs);
  };

  return (
    <div className="relative min-h-screen w-full bg-background overflow-hidden flex flex-col items-center justify-center p-6 md:p-12">
      {/* Abstract background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-trustGreen/10 blur-[120px] rounded-full animate-glow-breathe" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-accent/10 blur-[150px] rounded-full animate-glow-breathe" style={{ animationDelay: '2s' }} />
      </div>

      <AnimatePresence mode="wait">
        {step === 'NPI' && <Screen1NPI key="step-1" onComplete={() => advanceTo('CONFIRM')} />}
        {step === 'CONFIRM' && <Screen2Confirm key="step-2" onComplete={() => advanceTo('PREFILL')} />}
        {step === 'PREFILL' && <Screen3Prefill key="step-3" onComplete={() => advanceTo('READY', 2500)} />}
        {step === 'READY' && <Screen4Ready key="step-4" onComplete={() => advanceTo('SHARE')} />}
        {step === 'SHARE' && <Screen5Share key="step-5" onRestart={() => advanceTo('NPI')} />}
      </AnimatePresence>

      {/* Development Controls (Visual Only) */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50 opacity-20 hover:opacity-100 transition-opacity">
        <button onClick={() => setStep('NPI')} className="text-xs bg-muted px-2 py-1 rounded">1</button>
        <button onClick={() => setStep('CONFIRM')} className="text-xs bg-muted px-2 py-1 rounded">2</button>
        <button onClick={() => setStep('PREFILL')} className="text-xs bg-muted px-2 py-1 rounded">3</button>
        <button onClick={() => setStep('READY')} className="text-xs bg-muted px-2 py-1 rounded">4</button>
        <button onClick={() => setStep('SHARE')} className="text-xs bg-muted px-2 py-1 rounded">5</button>
      </div>
    </div>
  );
}

// ── Screen 1: NPI Input ─────────────────────────────────────────────

function Screen1NPI({ onComplete }: { onComplete: () => void }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (npi: string) => {
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      onComplete();
    }, 800);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(10px)' }}
      transition={{ duration: durations.normal, ease: easings.easeOut }}
      className="w-full max-w-5xl mx-auto flex flex-col items-center justify-center gap-24 z-10"
    >
      <AntigravityHero
        headline="Verify once. Portable across employers where accepted."
        headlineClassName="text-5xl md:text-8xl lg:text-9xl xl:text-10xl tracking-tighter"
        subhead="Create a verified Clinician credential passport that stays ready."
        subheadClassName="text-xl md:text-2xl mt-4 max-w-2xl text-center"
      />

      <div className="w-full mt-12">
        <ProgressiveTrustInput
          label="National Provider Identifier"
          placeholder="Enter NPI Number"
          onSubmit={handleSubmit}
          isLoading={isLoading}
          maxLength={10}
          pattern="\d*"
        />
      </div>
    </motion.div>
  );
}

// ── Screen 2: Confirm Identity ──────────────────────────────────────

function Screen2Confirm({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -40, filter: 'blur(10px)' }}
      transition={{ duration: durations.normal, ease: easings.easeOut }}
      className="w-full max-w-3xl flex flex-col items-center gap-12 z-10"
    >
      <AntigravityHero
        headline="Is this you?"
        align="center"
        headlineClassName="text-5xl md:text-8xl tracking-tight"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, duration: durations.slow, ease: easings.easeOut }}
        className="glass motion-glass-card w-full p-8 md:p-12 rounded-3xl flex flex-col md:flex-row items-center gap-8 text-center md:text-left"
      >
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full bg-muted flex items-center justify-center text-4xl font-light text-muted-foreground border-4 border-background shadow-glass">
          JD
        </div>
        <div className="flex flex-col gap-2 flex-grow">
          <h2 className="text-3xl md:text-4xl font-heading font-medium">Dr. Jane Doe, MD</h2>
          <p className="text-xl md:text-2xl text-muted-foreground font-light">Cardiology • NPI 1234567890</p>
          <div className="flex gap-4 mt-4 justify-center md:justify-start">
             <div className="flex items-center gap-2 text-trustGreen font-medium px-4 py-2 bg-trustGreen/10 rounded-full">
               <ShieldCheck className="w-5 h-5" />
               NPI Active
             </div>
             <div className="flex items-center gap-2 text-trustGreen font-medium px-4 py-2 bg-trustGreen/10 rounded-full">
               <ShieldCheck className="w-5 h-5" />
               OIG Clear
             </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="flex gap-6 w-full md:w-auto"
      >
         <button className="text-muted-foreground hover:text-foreground px-8 py-4 text-xl transition-colors">
           Not me
         </button>
         <ButtonPrimary onClick={onComplete} className="text-xl px-12 py-8 rounded-full shadow-elevated">
           Yes, continue
           <ArrowRight className="ml-2 w-6 h-6" />
         </ButtonPrimary>
      </motion.div>
    </motion.div>
  );
}

// ── Screen 3: Auto-Prefill Data ─────────────────────────────────────

function Screen3Prefill({ onComplete }: { onComplete: () => void }) {
  // We don't have buttons here, it just auto-advances after showing the animation.
  // The parent handles the timeout.

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      transition={{ duration: durations.slow, ease: easings.easeOut }}
      className="w-full max-w-4xl flex flex-col items-center text-center gap-16 z-10"
    >
      <AntigravityHero
        headline="Assembling your credentials..."
        headlineClassName="text-4xl md:text-6xl lg:text-8xl tracking-tight"
        subhead="VitalCV is securely fetching licenses, board certifications, and DEA registrations from primary sources."
      />

      {/* Abstract scanning visualization */}
      <div className="relative w-full max-w-2xl h-80 rounded-3xl overflow-hidden glass-heavy border border-white/10 dark:border-white/5">
        
        {/* Scanning laser line */}
        <motion.div 
          className="absolute left-0 right-0 h-1 bg-trustGreen shadow-[0_0_20px_4px_rgba(20,184,166,0.6)] z-20"
          initial={{ top: '0%' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 3, ease: 'linear', repeat: Infinity }}
        />

        {/* Mock data rows appearing */}
        <div className="absolute inset-0 p-8 flex flex-col justify-between z-10">
           {[0, 1, 2, 3].map((i) => (
             <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.4, duration: durations.normal }}
                className="w-full flex items-center gap-4"
             >
                <div className="h-10 w-10 rounded-full bg-trustGreen/20 flex items-center justify-center text-trustGreen">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-grow h-4 bg-muted rounded animate-shimmer" style={{ width: `${80 - i * 15}%` }} />
             </motion.div>
           ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Screen 4: Instant Readiness State ───────────────────────────────

function Screen4Ready({ onComplete }: { onComplete: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -40 }}
      transition={{ duration: durations.slow, ease: easings.spring }}
      className="w-full max-w-5xl flex flex-col items-center gap-12 z-10"
    >
      <motion.div
         initial={{ scale: 0 }}
         animate={{ scale: 1 }}
         transition={{ type: 'spring', damping: 12, delay: 0.2 }}
         className="w-24 h-24 rounded-full bg-trustGreen/20 text-trustGreen flex items-center justify-center mb-[-2rem] z-20 relative shadow-glow"
      >
        <ShieldCheck className="w-12 h-12" />
      </motion.div>

      <AntigravityHero
        headline="Ready."
        headlineClassName="text-6xl md:text-9xl tracking-tighter text-trustGreen"
        subhead="Your 100% verified portable credential package is built."
      />

       <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: durations.normal }}
          className="w-full"
       >
         <ProfileSummaryCard
           npi="1234567890"
           name="Jane Doe, MD"
           specialty="Cardiology"
           location="San Francisco, CA"
           verifiedStatus="L3"
         />
       </motion.div>

       <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
       >
         <ButtonPrimary onClick={onComplete} className="text-xl px-12 py-8 rounded-full shadow-elevated bg-foreground text-background hover:bg-foreground/90">
           Continue
           <ArrowRight className="ml-2 w-6 h-6" />
         </ButtonPrimary>
       </motion.div>
    </motion.div>
  );
}

// ── Screen 5: Immediate Sharing ─────────────────────────────────────

function Screen5Share({ onRestart }: { onRestart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: durations.slow, ease: easings.easeOut }}
      className="w-full max-w-4xl flex flex-col items-center text-center gap-12 z-10"
    >
      <AntigravityHero
        headline="Send it anywhere."
        headlineClassName="text-5xl md:text-8xl tracking-tight"
        subhead="No account creation required to share. Provide a verified link directly to HR, Credentialing Committees, or Locums agencies."
      />

      <div className="glass-heavy w-full p-8 md:p-12 rounded-3xl flex flex-col items-center gap-8 shadow-elevated">
         <div className="w-full flex items-center justify-between bg-background p-4 md:p-6 rounded-2xl border border-border">
            <span className="text-lg md:text-2xl font-mono text-muted-foreground truncate mr-4">
              vitalcv.com/p/jane-doe-1234
            </span>
            <ButtonPrimary className="shrink-0 text-lg px-6 py-6 rounded-xl">
              <Share2 className="mr-2 w-5 h-5" />
              Copy Link
            </ButtonPrimary>
         </div>

         <div className="w-full grid justify-center grid-cols-1 md:grid-cols-2 gap-4 mt-4">
           <button className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-foreground text-background font-medium text-lg hover:scale-[1.02] transition-transform">
              Email to Employer
           </button>
           <button className="flex items-center justify-center gap-3 p-6 rounded-2xl bg-muted text-foreground font-medium text-lg hover:bg-muted/80 transition-colors">
              Download PDF Package
           </button>
         </div>
      </div>

       {/* Extra subtle link to restart demo */}
       <button onClick={onRestart} className="mt-12 text-muted-foreground hover:text-foreground text-sm tracking-widest uppercase">
         Restart Demo Flow
       </button>
    </motion.div>
  );
}
