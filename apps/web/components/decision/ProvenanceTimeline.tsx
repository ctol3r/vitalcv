'use client';

import { Shield, Circle, FileText, CheckCircle, GitCommit, GitPullRequest } from 'lucide-react';
import { motion } from 'framer-motion';

export type ProvenanceEventType = 'VERIFICATION' | 'SYSTEM' | 'EXTERNAL_SOURCE' | 'ATTESTATION';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  type: ProvenanceEventType;
  description?: string;
  hash?: string;
}

interface ProvenanceTimelineProps {
  events: TimelineEvent[];
}

const TYPE_CONFIG = {
  VERIFICATION: { icon: Shield, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  SYSTEM: { icon: Circle, color: 'text-slate-500', bg: 'bg-slate-500/10' },
  EXTERNAL_SOURCE: { icon: FileText, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  ATTESTATION: { icon: CheckCircle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
};

export function ProvenanceTimeline({ events }: ProvenanceTimelineProps) {
  return (
    <div className="flex flex-col w-full h-full relative">
      <div className="absolute left-6 top-6 bottom-6 w-px bg-slate-200 dark:bg-slate-800" />
      
      <div className="space-y-8 py-6 relative z-10">
        {events.map((event, index) => {
          const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.SYSTEM;
          const Icon = config.icon;

          return (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-6 px-2"
            >
              <div className={`p-2 rounded-full border border-white dark:border-vt-neutral-900 bg-white dark:bg-vt-neutral-900 shadow-sm relative z-20`}>
                <div className={`p-1.5 rounded-full ${config.bg} ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              
              <div className="flex-1 flex flex-col pt-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {event.actor}
                  </span>
                </div>
                
                <p className="text-base text-slate-900 dark:text-slate-100 font-light mb-1">
                  {event.action}
                </p>
                
                {event.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    {event.description}
                  </p>
                )}

                {event.hash && (
                  <div className="flex items-center gap-2 mt-2 px-3 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800/50 w-fit border border-slate-100 dark:border-slate-800">
                    <GitPullRequest className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tracking-wider">
                      {event.hash}
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
