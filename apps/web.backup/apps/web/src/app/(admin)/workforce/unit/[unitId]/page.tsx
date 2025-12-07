/**
 * Unit Detail Page
 * Phase 3: Unit Detail & Staffing Intelligence
 */

'use client';

import { UnitDetailView } from '@/components/workforce/UnitDetailView';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { UnitDetail } from '@/lib/workforce/models';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

export default function UnitDetailPage() {
  const params = useParams();
  const unitId = params.unitId as string;
  const [unitDetail, setUnitDetail] = useState<UnitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUnitDetail = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/workforce/unit/${unitId}`);
        if (!response.ok) throw new Error('Failed to fetch unit details');
        const data = await response.json();
        setUnitDetail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load unit details');
      } finally {
        setLoading(false);
      }
    };

    if (unitId) {
      void loadUnitDetail();
    }
  }, [unitId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!unitDetail) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p>Unit not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <UnitDetailView unitDetail={unitDetail} />;
}








