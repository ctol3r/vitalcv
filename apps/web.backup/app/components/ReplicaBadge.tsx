'use client';

import { useEffect, useState } from 'react';
import { Server } from 'lucide-react';

export default function ReplicaBadge() {
  const [replica, setReplica] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const base = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';
        const response = await fetch(`${base}/api/traffic/health`);
        const data = await response.json();
        setReplica(data.instance || 'unknown');
      } catch {
        setReplica('offline');
      }
    })();
  }, []);

  if (!replica || replica === 'local') return null;

  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-full">
      <Server className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
      <span className="text-xs font-medium text-purple-700 dark:text-purple-300">
        {replica}
      </span>
    </div>
  );
}
