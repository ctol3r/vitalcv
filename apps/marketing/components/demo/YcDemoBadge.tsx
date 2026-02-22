'use client';

import { useEffect, useState } from 'react';

export function YcDemoBadge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch('/api/demo/status')
      .then((r) => r.json())
      .then((d) => {
        if (d.demo_mode) setVisible(true);
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 rounded-full bg-yellow-400 px-3 py-1 text-xs font-bold uppercase tracking-wider text-black shadow-lg">
      YC Demo
    </div>
  );
}
