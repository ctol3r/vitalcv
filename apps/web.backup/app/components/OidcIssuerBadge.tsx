"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function OidcIssuerBadge() {
  const [meta, setMeta] = useState<any>();

  useEffect(() => {
    (async () => {
      const r = await fetch('/.well-known/openid-credential-issuer');
      setMeta(await r.json());
    })();
  }, []);

  return (
    <div className='text-xs px-2 py-1 rounded bg-green-50 border'>
      OIDC4VCI: {meta?.issuer || '—'}
    </div>
  );
}
