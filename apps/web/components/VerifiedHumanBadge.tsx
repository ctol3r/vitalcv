'use client';

import { Badge } from '@/components/ui/badge';
import { getSession, useSessionListener } from '@/lib/session';
import { BadgeCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

export function VerifiedHumanBadge() {
  const [verified, setVerified] = useState<boolean>(false);

  useEffect(() => {
    const s = getSession();
    setVerified(Boolean(s.verifiedHuman));

    const unsubscribe = useSessionListener((session) => {
      setVerified(Boolean(session.verifiedHuman));
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  if (!verified) return null;

  return (
    <Badge variant="secondary" className="gap-1">
      <BadgeCheck className="h-3.5 w-3.5" />
      Verified Human
    </Badge>
  );
}


