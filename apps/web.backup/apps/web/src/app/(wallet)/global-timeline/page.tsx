'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, CheckCircle, XCircle, RefreshCcw, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:4000';

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  verified: boolean;
}

interface Timeline {
  events: TimelineEvent[];
  gaps: Array<{ start: string; end: string; type: string }>;
  duplicates: Array<{ eventIds: string[]; type: string }>;
  integrity: { score: number; issues: string[] };
}

export default function GlobalTimelinePage() {
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real app, would get clinicianId from auth context
    const clinicianId = 'demo-clinician-id';
    loadTimeline(clinicianId);
  }, []);

  async function loadTimeline(clinicianId: string) {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/timeline/${clinicianId}`);
      if (response.ok) {
        const data = await response.json();
        setTimeline(data);
      }
    } catch (error) {
      console.error('Failed to load timeline:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!timeline) return;
    try {
      const blob = new Blob([JSON.stringify(timeline, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `credential-timeline-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export:', error);
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'license':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'board':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'sanctions':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Global Credential Timeline</h1>
          <p className="text-muted-foreground mt-2">
            Synthesized timeline of all credential events
          </p>
        </div>
        {timeline && (
          <Button onClick={handleExport} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        )}
      </div>

      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <RefreshCcw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          </CardContent>
        </Card>
      ) : timeline ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Integrity Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{timeline.integrity.score.toFixed(2)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {timeline.integrity.issues.length} issues
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Events</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{timeline.events.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Total events</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Gaps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{timeline.gaps.length}</div>
                <div className="text-sm text-muted-foreground mt-1">Timeline gaps</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Timeline Events</CardTitle>
              <CardDescription>All credential events in chronological order</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {timeline.events.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    {getEventIcon(event.type)}
                    <div className="flex-1">
                      <div className="font-medium capitalize">{event.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()} • {event.source}
                      </div>
                    </div>
                    <Badge variant={event.verified ? 'default' : 'secondary'}>
                      {event.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {timeline.gaps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Timeline Gaps</CardTitle>
                <CardDescription>Missing events detected</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timeline.gaps.map((gap, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border rounded-lg border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <div className="flex-1">
                        <div className="font-medium">{gap.type}</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(gap.start).toLocaleDateString()} - {new Date(gap.end).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {timeline.integrity.issues.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Integrity Issues</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {timeline.integrity.issues.map((issue, idx) => (
                    <div key={idx} className="p-2 border rounded text-sm text-muted-foreground">
                      {issue}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No timeline data available
          </CardContent>
        </Card>
      )}
    </div>
  );
}

