'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ArrowRight, Clock, Eye, Network, Shield, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import type { PulseEvent, PulseSeverity } from './types';

interface PulseFeedProps {
  events: PulseEvent[];
  onInspect?: (event: PulseEvent) => void;
}

const severityCopy: Record<PulseSeverity, { label: string; tone: string }> = {
  info: { label: 'Info', tone: 'bg-sky-50 text-sky-800 border-sky-100 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-800' },
  success: { label: 'Healthy', tone: 'bg-emerald-50 text-emerald-800 border-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800' },
  warning: { label: 'Needs review', tone: 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800' },
  critical: { label: 'Critical', tone: 'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800' },
};

const typeIcon = {
  credential: <Shield className="h-4 w-4 text-blue-600 dark:text-blue-300" />,
  verification: <Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />,
  network: <Network className="h-4 w-4 text-indigo-600 dark:text-indigo-300" />,
  profile: <UserCircle2 className="h-4 w-4 text-sky-600 dark:text-sky-300" />,
  compliance: <Shield className="h-4 w-4 text-amber-600 dark:text-amber-300" />,
};

function formatTimestamp(timestamp: string) {
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return timestamp;
  }
}

export function PulseFeed({ events, onInspect }: PulseFeedProps) {
  const orderedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      ),
    [events],
  );

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200 shadow-sm dark:bg-neutral-950/60 dark:border-neutral-800">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl">Pulse</CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            Calm, time-ordered updates about what changed across your credential graph.
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs">
          Live
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        {orderedEvents.map((event, idx) => (
          <div key={event.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-100">
                  {typeIcon[event.type]}
                </span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{event.title}</span>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium border ${severityCopy[event.severity].tone}`}
                    >
                      {severityCopy[event.severity].label}
                    </Badge>
                    {event.relatedEntity?.label && (
                      <Badge variant="secondary" className="text-[11px]">
                        {event.relatedEntity.label}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{event.summary}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatTimestamp(event.timestamp)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-foreground/60">
                      {event.source}
                    </span>
                    {event.tags && event.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {event.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[11px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {event.links.map((link) =>
                  link.destination === 'inspect' && onInspect ? (
                    <Button
                      key={`${event.id}-${link.label}`}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => onInspect(event)}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Inspect
                    </Button>
                  ) : (
                    <Button
                      key={`${event.id}-${link.label}`}
                      variant="ghost"
                      size="sm"
                      className="text-xs"
                      asChild
                    >
                      <Link href={link.href}>
                        {link.label}
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  ),
                )}
              </div>
            </div>
            {idx < orderedEvents.length - 1 && <Separator />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
