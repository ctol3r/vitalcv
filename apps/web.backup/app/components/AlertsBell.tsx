'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AlertsBell() {
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const es = new EventSource('/api/alerts/stream');
    es.addEventListener('alert', (e: any) => {
      try {
        const j = JSON.parse(e.data);
        setItems((a) => [j, ...a].slice(0, 5));
      } catch {}
    });

    return () => es.close();
  }, []);

  return (
    <button
      className="text-xs px-2 py-1 border rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      onClick={() => router.push('/ops/pilot/center')}
      title={`${items.length} alert${items.length !== 1 ? 's' : ''}`}
    >
      🔔 {items.length}
    </button>
  );
}

