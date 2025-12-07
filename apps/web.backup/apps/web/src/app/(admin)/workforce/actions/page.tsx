/**
 * Workforce Actions Page
 * Phase 5: Operational Actions & Administration
 */

'use client';

import { WorkforceActionsView } from '@/components/workforce/WorkforceActionsView';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function WorkforceActionsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  return <WorkforceActionsView />;
}








