import React from 'react';
import { Skeleton } from '../components/Skeleton';

export default function VerifierLoading() {
  return (
    <div className="container mx-auto max-w-2xl p-6 space-y-8 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-full space-y-6">
         <div className="h-10 bg-slate-200 rounded w-2/3 mx-auto animate-pulse"></div>
         <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto animate-pulse"></div>

         <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 w-full h-64 flex items-center justify-center">
             <div className="h-32 w-32 bg-slate-200 rounded-lg animate-pulse"></div>
         </div>

         <Skeleton lines={3} className="w-full" />
      </div>
    </div>
  );
}

