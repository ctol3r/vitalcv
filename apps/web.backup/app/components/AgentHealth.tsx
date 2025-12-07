"use client";
import { useEffect, useState } from 'react';

export default function AgentHealth() {
  const [ok, setOk] = useState<boolean>();

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch((process.env.NEXT_PUBLIC_AGENT_BASE || '') + '/healthz');
        setOk(r.ok);
      } catch {
        setOk(false);
      }
    })();
  }, []);

  return (
    <span className={`text-xs ${ok ? 'text-green-600' : 'text-red-600'}`}>
      {ok ? 'Agent: healthy' : 'Agent: down'}
    </span>
  );
}

