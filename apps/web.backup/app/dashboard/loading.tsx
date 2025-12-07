import React from 'react';
import { CardSkeleton, TableSkeleton } from '../components/Skeleton';

export default function DashboardLoading() {
  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-4"></div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <div className="space-y-4">
         <div className="h-6 bg-slate-200 rounded w-32 animate-pulse"></div>
         <TableSkeleton />
      </div>
    </div>
  );
}

