"use client";
import { useEffect, useRef, useState } from 'react';

const STEPS = [
  { t: 0, note: 'Welcome — we'll show Agent + Playbook + Compacts + Survey Packet' },
  { t: 8, action: '/agent', note: 'Run a verify + watch Live Verifies' },
  { t: 20, action: '/playbook', note: 'Generate a Compliance Playbook' },
  { t: 32, action: '/admin/digests/heatmap', note: 'See where rules changed' },
  { t: 44, action: '/compliance', note: 'Download the Survey Packet PDF' }
];

export default function AutoDemo() {
  const [i, setI] = useState(0);
  const timer = useRef<any>();

  useEffect(() => {
    timer.current = setInterval(() => setI(x => Math.min(x + 1, STEPS.length - 1)), 8000);
    return () => clearInterval(timer.current);
  }, []);

  useEffect(() => {
    const s = STEPS[i];
    if (s.action) location.assign(s.action);
  }, [i]);

  return (
    <div className='max-w-xl mx-auto py-8'>
      <h1 className='text-xl font-bold'>Auto Demo</h1>
      <div className='p-3 border rounded text-sm'>
        <div className='font-semibold'>Step {i + 1}/{STEPS.length}</div>
        <div className='text-xs opacity-70'>{STEPS[i].note}</div>
        <div className='mt-2 text-[11px]'>
          Auto-advances every ~8s. You can navigate back anytime.
        </div>
      </div>
    </div>
  );
}

