'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface RibbonEvent {
  id: string;
  source: string;
  text: string;
  timestamp: number;
}

const MOCK_EVENTS = [
  { id: '1', source: 'System', text: 'Dr. Chen → Trust Decline detected', timestamp: Date.now() },
  { id: '2', source: 'Intelligence', text: 'New storyline created', timestamp: Date.now() - 5000 },
  { id: '3', source: 'Network', text: 'Clinical Trial update', timestamp: Date.now() - 15000 },
  { id: '4', source: 'Calibration', text: 'Anomaly threshold adjusted to 0.85', timestamp: Date.now() - 45000 },
  { id: '5', source: 'Security', text: 'Credentials verified for NPI #109348123', timestamp: Date.now() - 120000 },
];

export function LiveFeedRibbon() {
  const [events, setEvents] = useState<RibbonEvent[]>(MOCK_EVENTS);
  const [timeSinceLast, setTimeSinceLast] = useState<number>(0);

  // Pulse logic
  useEffect(() => {
    const interval = setInterval(() => {
      if (events.length > 0) {
        const latest = Math.max(...events.map(e => e.timestamp));
        setTimeSinceLast(Date.now() - latest);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [events]);

  const pulseColor = 
    timeSinceLast < 10000 ? 'bg-[var(--vt-success)] shadow-[0_0_8px_var(--vt-success)]' :
    timeSinceLast < 60000 ? 'bg-[var(--vt-warning)] shadow-[0_0_8px_var(--vt-warning)]' :
    'bg-[var(--vt-text-muted)]';

  return (
    <div className="flex w-full flex-col">
      {/* Live Feed Ribbon + Pulse Indicator */}
      <div className="flex items-center w-full h-[36px] rounded-[var(--vt-radius-md)] border border-[var(--vt-border)] bg-[var(--vt-surface)] px-[var(--vt-space-12)] mb-[var(--vt-space-16)] relative overflow-hidden shadow-[var(--vt-shadow-sm)]">
        
        {/* Scrolling Ticker */}
        <div 
          className="flex-1 overflow-hidden relative group" 
          style={{ maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)' }}
        >
          <div 
            className="flex items-center whitespace-nowrap h-full"
            style={{ animation: 'vt-ticker 25s linear infinite' }}
            onMouseEnter={(e) => (e.currentTarget.style.animationPlayState = 'paused')}
            onMouseLeave={(e) => (e.currentTarget.style.animationPlayState = 'running')}
          >
            {/* Provide duplicate elements for continuous scroll illusion */}
            {[...events, ...events, ...events, ...events].map((ev, i) => (
              <span key={i} className="mx-8 text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)] flex items-center gap-2">
                {ev.source && <span className="font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)] uppercase tracking-[0.1em] text-[10px]">{ev.source}</span>}
                {ev.source && <span className="text-[var(--vt-text-muted)]">/</span>}
                <span className="text-[var(--vt-text-primary)] opacity-90">{ev.text}</span>
              </span>
            ))}
          </div>
          <style>{`
            @keyframes vt-ticker {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>

        {/* Pulse Indicator */}
        <div className="shrink-0 flex items-center gap-[var(--vt-space-8)] ml-6 pl-5 border-l border-[var(--vt-border)]">
          <div className={cn('h-1.5 w-1.5 rounded-full transition-colors duration-1000', pulseColor)} />
          <span className="text-[10px] font-[var(--vt-font-weight-semibold)] uppercase tracking-[0.2em] text-[var(--vt-text-secondary)]">LIVE</span>
        </div>
      </div>
    </div>
  );
}
