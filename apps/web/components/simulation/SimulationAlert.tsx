'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ServerCrash, ShieldAlert } from 'lucide-react';

interface SimulationAlertProps {
  isVisible: boolean;
  organizations: string[];
}

export function SimulationAlert({ isVisible, organizations }: SimulationAlertProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{
            type: 'spring',
            damping: 15,
            stiffness: 200,
            mass: 0.8,
          }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
        >
          <div className="relative overflow-hidden rounded-2xl border border-red-500/30 bg-black/80 backdrop-blur-2xl shadow-2xl shadow-red-900/20 p-6">

            {/* Animated background glow */}
            <motion.div
              animate={{
                opacity: [0.1, 0.3, 0.1],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 bg-red-500/10 rounded-full blur-3xl pointer-events-none"
            />

            <div className="relative flex items-start gap-4">
              <div className="p-3 bg-red-500/20 rounded-xl rounded-tl-sm ring-1 ring-red-500/50">
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    Credential Revoked
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                  </h3>
                  <p className="text-red-200/80 text-sm mt-1 leading-relaxed">
                    A critical cryptographic revocation has been detected. Cascading trust invalidation in progress across the network mesh.
                  </p>
                </div>

                {organizations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-mono font-medium tracking-wider text-red-400/80 uppercase flex items-center gap-2">
                      <ServerCrash className="w-3 h-3" />
                      Affected Organizations
                    </div>

                    <motion.div
                      className="space-y-2"
                      initial="hidden"
                      animate="visible"
                      variants={{
                        hidden: { opacity: 0 },
                        visible: {
                          opacity: 1,
                          transition: { staggerChildren: 0.1 }
                        }
                      }}
                    >
                      {organizations.map((org, index) => (
                        <motion.div
                          key={org}
                          variants={{
                            hidden: { opacity: 0, x: -10 },
                            visible: { opacity: 1, x: 0 }
                          }}
                          className="flex items-center justify-between p-2 rounded-lg bg-red-950/40 border border-red-900/50"
                        >
                          <span className="text-sm font-medium text-red-100">{org}</span>
                          <ShieldAlert className="w-4 h-4 text-red-500/70" />
                        </motion.div>
                      ))}
                    </motion.div>
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 4, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-600 to-red-400"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
