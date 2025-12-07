import React from 'react';

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, lines = 1 }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
            key={i}
            className={`h-4 bg-slate-200 rounded w-full ${i > 0 ? 'mt-2' : ''}`}
        />
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
    return (
        <div className="p-4 border rounded-lg shadow-sm bg-white space-y-4 animate-pulse">
            <div className="h-6 bg-slate-200 rounded w-1/3"></div>
            <div className="space-y-2">
                <div className="h-4 bg-slate-200 rounded w-full"></div>
                <div className="h-4 bg-slate-200 rounded w-5/6"></div>
            </div>
            <div className="h-10 bg-slate-200 rounded w-full mt-4"></div>
        </div>
    )
}

export const TableSkeleton: React.FC = () => {
    return (
        <div className="w-full border rounded-lg overflow-hidden animate-pulse">
            <div className="h-12 bg-slate-100 border-b"></div>
            <div className="divide-y">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-16 bg-white p-4 flex items-center space-x-4">
                        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                        <div className="h-4 bg-slate-200 rounded w-1/6 ml-auto"></div>
                    </div>
                ))}
            </div>
        </div>
    )
}

