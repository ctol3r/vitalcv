'use client';

import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

export default function StickyGeo() {
  const [region, setRegion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';
        const response = await fetch(`${base}/api/traffic/health`);
        const data = await response.json();
        setRegion(data.region || 'us-east-1');
      } catch {
        setRegion('unknown');
      }
    })();
  }, []);

  if (!region || region === 'unknown') return null;

  const regionNames: Record<string, string> = {
    'us-east-1': 'US East',
    'us-west-2': 'US West',
    'eu-west-1': 'EU West',
    'ap-southeast-1': 'Asia Pacific',
  };

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-full">
      <Globe className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
        {regionNames[region] || region}
      </span>
    </div>
  );
}
