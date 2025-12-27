'use client';

import { useEffect, useState } from 'react';

type Match = {
  jobId: string;
  score: number;
  readinessPercent: number;
  explanation: string[];
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    const fetchMatches = async () => {
      const res = await fetch('/api/matches?clinicianId=clinician-123');
      const data = await res.json();
      setMatches(data);
    };
    fetchMatches();
  }, []);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Job Matches</h1>
      {matches.map((match) => (
        <div key={match.jobId} className="p-4 border rounded">
          <h2 className="text-xl">Job: {match.jobId}</h2>
          <p>Score: {match.score}</p>
          <p>Readiness: {match.readinessPercent}%</p>
          <ul className="text-sm text-gray-600">
            {match.explanation.map((reason, i) => (
              <li key={i}>• {reason}</li>
            ))}
          </ul>
        </div>
      ))}
    </main>
  );
}
