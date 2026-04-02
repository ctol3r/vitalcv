'use client';

import { CredentialReadinessCard, ReadinessState, TrustLevel } from './CredentialReadinessCard';
import { Shield, Fingerprint, Activity, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

export function ReadinessDashboard() {
  // Demo state
  const demoAlerts = [
    {
      id: '1',
      type: 'expiring' as const,
      title: 'ACLS Certification',
      description: 'American Heart Association ACLS is expiring soon.',
      daysRemaining: 14,
    },
    {
      id: '2',
      type: 'missing' as const,
      title: 'State Medical License (CA)',
      description: 'Verification check failed. Please re-upload your state license.',
    }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-foreground selection:bg-muted p-6 md:p-12 lg:p-24 flex flex-col gap-12">
      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted border border-border w-fit mb-4">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/70">VitalCV Live Network</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-serif tracking-tight text-foreground">Readiness Dashboard</h1>
        <p className="text-foreground/70 font-mono text-sm max-w-xl leading-relaxed mt-2">
          Your cryptographic credentials, verified trust state, and operational readiness. 
          No clutter. Just the facts.
        </p>
      </header>

      {/* Main Readiness Card */}
      <section className="max-w-4xl">
        <CredentialReadinessCard
          state="CONDITIONALLY_READY"
          score={85}
          trustLevel="L2"
          alerts={demoAlerts}
          onPrimaryAction={() => console.log('Primary action clicked')}
        />
      </section>

      {/* Minimalistic Trust Assets Grid (for "no dashboard clutter" goal) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl">
        {[
          { icon: Fingerprint, label: 'Verified Identity', value: 'Level 2 IAL' },
          { icon: Shield, label: 'PSV Credentials', value: '4 Active' },
          { icon: Clock, label: 'Audit Log', value: 'Immutable' }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i }}
            className="p-6 rounded-2xl bg-muted border border-white/5 hover:bg-muted transition-colors"
          >
            <item.icon className="w-5 h-5 text-muted-foreground mb-4" />
            <div className="text-sm font-mono text-foreground/70">{item.label}</div>
            <div className="text-lg font-medium text-white/90 mt-1">{item.value}</div>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
