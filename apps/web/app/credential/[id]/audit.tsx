import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface AuditEventMetadata {
  scope?: string[] | string | null;
  recipient?: string | null;
}

interface AuditEvent {
  auditRef: string;
  eventType: string;
  type: string;
  credentialId?: string | null;
  clinicianId?: number | null;
  timestamp: string;
  metadata?: AuditEventMetadata | null;
}

const iconMap: Record<string, string> = {
  issuance: '🪪',
  verification: '✅',
  revocation: '⛔',
  consent: '📝',
  match: '🔗',
  hire: '🧑‍⚕️',
};

const orderedGroups = ['issuance', 'verification', 'consent', 'revocation', 'match', 'hire'];

const formatScope = (scope: AuditEventMetadata['scope']) => {
  if (Array.isArray(scope)) return scope.join(', ');
  if (typeof scope === 'string' && scope.trim()) return scope;
  return 'Full disclosure';
};

const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

const buildCsv = (events: AuditEvent[]) => {
  const header = [
    'eventType',
    'type',
    'credentialId',
    'clinicianId',
    'timestamp',
    'scope',
    'recipient',
    'auditRef',
  ];
  const rows = events.map((event) => [
    escapeCsv(event.eventType),
    escapeCsv(event.type),
    escapeCsv(event.credentialId ?? ''),
    escapeCsv(event.clinicianId ? String(event.clinicianId) : ''),
    escapeCsv(event.timestamp),
    escapeCsv(formatScope(event.metadata?.scope)),
    escapeCsv(event.metadata?.recipient ?? ''),
    escapeCsv(event.auditRef),
  ]);
  return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
};

export async function AuditTimeline({ credentialId }: { credentialId: string }) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
  let response: Response;
  try {
    response = await fetch(
      `${backendUrl}/audit/history?credentialId=${encodeURIComponent(credentialId)}`,
      { cache: 'no-store' },
    );
  } catch (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Timeline</CardTitle>
          <CardDescription>Unable to load audit history.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-600">
            Failed to reach the audit API: {error instanceof Error ? error.message : 'Unknown error'}.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!response.ok) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Timeline</CardTitle>
          <CardDescription>Unable to load audit history.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-rose-600">HTTP {response.status} from audit API.</p>
        </CardContent>
      </Card>
    );
  }

  const payload = (await response.json()) as { events?: AuditEvent[] };
  const events = Array.isArray(payload.events) ? payload.events : [];
  const grouped = events.reduce<Record<string, AuditEvent[]>>((acc, event) => {
    const key = event.eventType || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {});
  const additionalGroups = Object.keys(grouped).filter((key) => !orderedGroups.includes(key));
  const groups = [...orderedGroups, ...additionalGroups];
  const jsonExport = JSON.stringify(events, null, 2);
  const csvExport = buildCsv(events);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Timeline</CardTitle>
        <CardDescription>Chronological events for credential {credentialId}.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <a
              download={`audit-${credentialId}.json`}
              href={`data:application/json;charset=utf-8,${encodeURIComponent(jsonExport)}`}
            >
              Export JSON
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              download={`audit-${credentialId}.csv`}
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(csvExport)}`}
            >
              Export CSV
            </a>
          </Button>
          <span className="text-xs text-muted-foreground">{events.length} events</span>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit events recorded yet.</p>
        ) : (
          <div className="space-y-8">
            {groups.map((group) => {
              const entries = grouped[group];
              if (!entries || entries.length === 0) return null;
              return (
                <section key={group} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{iconMap[group] ?? '📌'}</span>
                    <h3 className="text-base font-semibold capitalize">{group}</h3>
                    <Badge variant="secondary">{entries.length}</Badge>
                  </div>
                  <ol className="relative border-l border-border pl-6">
                    {entries.map((entry) => (
                      <li key={entry.auditRef} className="mb-6 last:mb-0">
                        <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                          {iconMap[group] ?? '•'}
                        </span>
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold">{entry.type}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Scope: {formatScope(entry.metadata?.scope)} · Recipient:{' '}
                            {entry.metadata?.recipient ?? '—'}
                          </div>
                          <div className="text-xs text-muted-foreground">Audit Ref: {entry.auditRef}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AuditTimeline;
