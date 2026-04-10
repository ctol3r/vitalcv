import React from 'react';

export default function DailyUtilityLoop({ score, blockers }: { score: number, blockers: string[] }) {
  return (
    <div className="p-6 bg-background text-foreground border rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-4">Your Career Passport</h2>
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-trust-green/10 text-trust-green rounded-full font-bold text-xl">
          {score}/100
        </div>
        <p className="text-muted-foreground">Keep your trust score high to ensure instant credential transmission to employers.</p>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold">Suggested Actions</h3>
        {blockers.length === 0 ? (
          <div className="p-4 bg-muted rounded">You're completely ready. All credentials are up to date!</div>
        ) : (
          blockers.map((b, i) => (
            <div key={i} className="flex justify-between items-center p-3 border rounded">
              <span className="text-amber-500 font-medium">{b}</span>
              <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm">Resolve</button>
            </div>
          ))
        )}
      </div>

      <div className="mt-8">
        <h3 className="font-semibold mb-3">Recent Activity</h3>
        <ul className="text-sm space-y-2 text-muted-foreground">
          <li>• OIG Sanctions re-verified automatically (2 days ago)</li>
          <li>• NPPES Identity check renewed (5 days ago)</li>
        </ul>
      </div>
    </div>
  );
}
