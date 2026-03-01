'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { BlePresentationService } from '../../../lib/credentials/blePresentation';

export function OfflineRadar() {
  const [isOffline, setIsOffline] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [dots, setDots] = useState([{ id: 1, x: 50, y: 50, opacity: 0 }]);

  useEffect(() => {
    // Check initial state
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Simulate scanning dots occasionally
  useEffect(() => {
    if (!isOffline) return;

    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length > 5) return prev.slice(1);
        return [...prev, {
          id: Date.now(),
          x: Math.random() * 80 + 10,
          y: Math.random() * 80 + 10,
          opacity: 1
        }];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [isOffline]);

  const handleBroadcast = async () => {
    setIsBroadcasting(true);
    try {
      // Simulate grabbing the local isolated credential cache
      const vpToken = 'eyJhb...mock...chunk...';
      await BlePresentationService.startBroadcasting({
        vpToken,
        presentationId: `mesh-${Date.now()}`
      });
    } catch (e) {
      console.error(e);
      setIsBroadcasting(false);
    }
  };

  const stopBroadcast = async () => {
    await BlePresentationService.stopBroadcasting();
    setIsBroadcasting(false);
  };

  if (!isOffline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6"
      >
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse border border-rose-400" />
          <span className="text-xl font-bold tracking-widest text-slate-100 uppercase">Offline Mode</span>
        </div>

        <p className="absolute top-16 left-8 text-slate-400 max-w-sm">
          No internet connection detected. The Genesis Mesh has been activated. Searching for secure Bluetooth receivers...
        </p>

        <div className="relative flex items-center justify-center w-[400px] h-[400px]">
          {/* Radar Circles */}
          {[1, 2, 3, 4].map(idx => (
            <motion.div
              key={idx}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: [0, 1, 1.5],
                opacity: [0, 0.5, 0]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                delay: idx * 1,
                ease: 'easeOut'
              }}
              className="absolute w-full h-full rounded-full border border-indigo-500/30"
              style={{ padding: `${idx * 20}%` }}
            />
          ))}

          {/* Simulated Verifier Dots */}
          {dots.map(dot => (
            <motion.div
              key={dot.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
              transition={{ duration: 4 }}
              className="absolute w-4 h-4 rounded-full bg-teal-400 shadow-[0_0_15px_rgba(45,212,191,0.6)]"
              style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
            />
          ))}

          {/* Center User Node */}
          <div className="relative z-10 w-24 h-24 rounded-full bg-indigo-600 shadow-[0_0_40px_rgba(79,70,229,0.5)] flex items-center justify-center border-4 border-slate-950">
            <span className="text-3xl">📳</span>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-slate-500 text-sm">
            {isBroadcasting ? 'Actively transmitting credentials securely via Web Bluetooth.' : 'Tap to selectively broadcast your verification packet.'}
          </p>
          <button
            onClick={isBroadcasting ? stopBroadcast : handleBroadcast}
            className={`px-8 py-3 rounded-xl font-bold transition-all text-sm uppercase tracking-wider
              ${isBroadcasting
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50 hover:bg-rose-500/30'
                : 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)]'
              }`}
          >
            {isBroadcasting ? 'Stop Transmission' : 'Broadcast Presentation'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
