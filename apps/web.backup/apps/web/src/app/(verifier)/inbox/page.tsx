interface InboxResponse {
  items: Array<{
    threadId: string;
    parentThreadId?: string | null;
    auditEventId: string;
    messageType: string;
    status: string;
    connectionId?: string | null;
    updatedAt: string;
    metadata?: Record<string, any> | null;
  }>;
}

export default async function VerifierInboxPage() {
  const inbox = await fetchInbox();

  return (
    <div className="space-y-6 p-6 lg:p-10">
      <header>
        <p className="text-sm font-medium text-muted-foreground">DIDComm</p>
        <h1 className="text-3xl font-semibold tracking-tight">Verifier inbox</h1>
        <p className="text-sm text-muted-foreground">
          Monitor incoming proof requests and issue-credential threads routed via DIDComm v2.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="grid grid-cols-6 bg-muted/40 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span>Thread</span>
          <span>Type</span>
          <span>Status</span>
          <span>Audit</span>
          <span>Connection</span>
          <span>Updated</span>
        </div>
        <div>
          {inbox.items.length === 0 ? (
            <p className="px-6 py-8 text-sm text-muted-foreground">No DIDComm activity yet.</p>
          ) : (
            inbox.items.map((item) => (
              <div
                key={item.threadId}
                className="grid grid-cols-6 items-center border-t px-6 py-4 text-sm"
              >
                <div className="truncate text-xs font-mono">{item.threadId}</div>
                <div className="text-muted-foreground">{shortType(item.messageType)}</div>
                <div className="font-medium">{item.status}</div>
                <div className="truncate text-xs font-mono">{item.auditEventId}</div>
                <div className="truncate text-xs">{item.connectionId ?? '—'}</div>
                <div className="text-right text-xs text-muted-foreground">
                  {new Date(item.updatedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

async function fetchInbox(): Promise<InboxResponse> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/api/didcomm/inbox`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`Backend responded with ${res.status}`);
    }
    return (await res.json()) as InboxResponse;
  } catch (error) {
    console.error('[verifier:inbox] failed to fetch inbox', error);
    return { items: [] };
  }
}

function shortType(type: string) {
  if (!type) return '—';
  const parts = type.split('/');
  return parts[parts.length - 1];
}











