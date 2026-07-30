import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EmployerHandoffLoadResult } from '@/lib/server/handoffReceipt';

function deliveryLabel(state: string): string {
  switch (state) {
    case 'acknowledged': return 'Acknowledged by transport';
    case 'delivered': return 'Delivered by transport';
    case 'logged_only': return 'Available in employer portal';
    case 'failed': return 'Delivery attempt failed';
    default: return 'No handoff recorded';
  }
}

function deliveryTone(state: string): string {
  if (state === 'acknowledged' || state === 'delivered') return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  if (state === 'failed') return 'border-amber-400/30 bg-amber-400/10 text-amber-100';
  return 'border-white/15 bg-white/[0.04] text-white/80';
}

export function EmployerHandoffReceiptCard({
  result,
}: {
  result: EmployerHandoffLoadResult;
}) {
  if (result.status !== 'ok') {
    const message = result.status === 'not_found'
      ? 'No canonical handoff receipt is attached to this application yet.'
      : result.status === 'unauthorized'
        ? 'Sign in with an authorized employer account to view handoff receipts.'
        : result.message;
    return (
      <Card className="border-white/10 bg-white/[0.04] text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Icon name="file-key" className="h-5 w-5" />Handoff receipt</CardTitle>
          <CardDescription className="text-white/60">{message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handoff = result.data;
  return (
    <Card className="border-white/10 bg-white/[0.04] text-white">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><Icon name="send" className="h-5 w-5" />Application handoff</CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-white/65">
              Immutable transport attempts for the exact packet attached to this application.
            </CardDescription>
          </div>
          <Badge variant="outline" className={deliveryTone(handoff.deliveryState)}>
            {deliveryLabel(handoff.deliveryState)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {handoff.packet ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <dt className="text-xs uppercase tracking-[0.14em] text-white/45">Packet version</dt>
              <dd className="mt-2 text-sm font-medium">Version {handoff.packet.version}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:col-span-2">
              <dt className="text-xs uppercase tracking-[0.14em] text-white/45">Packet hash</dt>
              <dd className="mt-2 break-all font-mono text-xs text-white/80">{handoff.packet.hash}</dd>
            </div>
          </dl>
        ) : null}

        {handoff.receipts.length > 0 ? (
          <ol className="space-y-3">
            {handoff.receipts.map((receipt) => (
              <li key={receipt.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-medium capitalize">Attempt {receipt.attemptNumber} · {receipt.channel.replace(/_/g, ' ')}</p>
                  <span className="text-xs uppercase tracking-[0.12em] text-white/50">{receipt.status.replace(/_/g, ' ')}</span>
                </div>
                <p className="mt-2 text-xs text-white/55">
                  Issued {new Date(receipt.issuedAt).toLocaleString()}
                  {receipt.deliveredAt ? ` · delivered ${new Date(receipt.deliveredAt).toLocaleString()}` : ''}
                </p>
                {receipt.limitation ? <p className="mt-3 text-sm leading-6 text-amber-100/85">{receipt.limitation}</p> : null}
                <p className="mt-3 break-all font-mono text-[11px] text-white/40">Receipt hash: {receipt.receiptHash}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-white/60">No immutable delivery attempt has been recorded.</p>
        )}

        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-50">
          <Icon name="alert" className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm leading-6">{handoff.notice}</p>
        </div>
      </CardContent>
    </Card>
  );
}
