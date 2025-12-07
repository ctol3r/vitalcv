import React from 'react';
import { TableSkeleton } from '../components/Skeleton';

export default function AdminLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
       <div className="flex items-center justify-between">
           <div className="h-8 bg-slate-200 rounded w-48 animate-pulse"></div>
           <div className="h-10 bg-slate-200 rounded w-32 animate-pulse"></div>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
           <div className="h-24 bg-slate-100 rounded-lg animate-pulse"></div>
           <div className="h-24 bg-slate-100 rounded-lg animate-pulse"></div>
           <div className="h-24 bg-slate-100 rounded-lg animate-pulse"></div>
           <div className="h-24 bg-slate-100 rounded-lg animate-pulse"></div>
       </div>

       <TableSkeleton />
    </div>
  );
}

