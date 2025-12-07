'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Link2, QrCode, SendHorizonal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ShareChannel = 'qr' | 'short-link' | 'nci-federation';

interface SharePanelProps {
  clinicianId: string;
  shortLink?: string;
}

interface ShareStatusState {
  status: 'idle' | 'sharing' | 'shared' | 'error';
  channel?: ShareChannel;
  message?: string;
}

const QR_SIZE = 6;

function buildQrPattern(seed: string) {
  const bytes = Array.from(seed).map((char) => char.charCodeAt(0));
  const cells = QR_SIZE * QR_SIZE;
  return Array.from({ length: cells }).map((_, idx) => {
    const byte = bytes[idx % bytes.length] ?? 0;
    return (byte + idx) % 3 !== 0;
  });
}

export function SharePanel({ clinicianId, shortLink = 'https://vital.passport/ava' }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [routingOrg, setRoutingOrg] = useState('nci:va');
  const [shareStatus, setShareStatus] = useState<ShareStatusState>({ status: 'idle' });
  const qrPattern = useMemo(() => buildQrPattern(clinicianId), [clinicianId]);

  const logShareEvent = useCallback(
    async (channel: ShareChannel) => {
      setShareStatus({ status: 'sharing', channel, message: 'Syncing with timeline…' });
      try {
        const response = await fetch('/api/demo/clinician/passport/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicianId, channel, shortLink, routingOrg }),
        });

        if (!response.ok) {
          throw new Error(`Share API returned ${response.status}`);
        }

        setShareStatus({
          status: 'shared',
          channel,
          message: channel === 'nci-federation' ? 'Sent via NCI federation' : 'Ready to scan or copy',
        });
      } catch (error) {
        console.error('[SharePanel] failed to log timeline event', error);
        setShareStatus({
          status: 'error',
          channel,
          message: 'Timeline logging failed — saved locally only.',
        });
      }
    },
    [clinicianId, routingOrg, shortLink],
  );

  const handleCopy = useCallback(async () => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      logShareEvent('short-link');
    } catch (error) {
      console.warn('[SharePanel] copy failed', error);
    }
  }, [logShareEvent, shortLink]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" aria-hidden="true" />
          Share passport
        </CardTitle>
        <CardDescription>QR scan, short link, or federated send through NCI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">QR payload</p>
            <Badge variant="outline">Device bound</Badge>
          </div>
          <div
            role="img"
            aria-label="QR code representing the selective disclosure payload"
            className="rounded-xl bg-white p-3 shadow-inner"
          >
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${QR_SIZE}, minmax(0, 1fr))` }}>
              {qrPattern.map((isDark, idx) => (
                <span
                  /* eslint-disable-next-line react/no-array-index-key */
                  key={idx}
                  className={`aspect-square rounded-sm ${isDark ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => logShareEvent('qr')}>
            <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
            Mark QR as shared
          </Button>
        </section>

        <section className="space-y-2">
          <label htmlFor="passport-short-link" className="text-sm font-medium">
            Short link
          </label>
          <div className="flex gap-2">
            <Input id="passport-short-link" value={shortLink} readOnly className="font-mono text-sm" />
            <Button variant="outline" onClick={handleCopy} aria-live="polite">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-medium">Federated send (NCI)</p>
          <div className="space-y-2">
            <label htmlFor="nci-routing" className="text-xs text-muted-foreground">
              Route to
            </label>
            <select
              id="nci-routing"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={routingOrg}
              onChange={(event) => setRoutingOrg(event.target.value)}
            >
              <option value="nci:va">Org B / Veterans Affairs</option>
              <option value="nci:ochn">Org B / Oceanview Health Network</option>
              <option value="nci:sutter">Org B / Sutter Mobility Pilot</option>
            </select>
          </div>
          <Button className="w-full" onClick={() => logShareEvent('nci-federation')}>
            <SendHorizonal className="mr-2 h-4 w-4" aria-hidden="true" />
            Send via NCI routing
          </Button>
        </section>

        <div role="status" className="rounded-lg border border-dashed p-3 text-sm" aria-live="polite">
          <p className="font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Timeline sync
          </p>
          <p className="text-muted-foreground">
            {shareStatus.status === 'idle'
              ? 'No share recorded yet.'
              : shareStatus.message ?? 'Share telemetry captured.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SharePanel;
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Check, Copy, Link2, QrCode, SendHorizonal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ShareChannel = 'qr' | 'short-link' | 'nci-federation';

interface SharePanelProps {
  clinicianId: string;
  shortLink?: string;
}

interface ShareStatusState {
  status: 'idle' | 'sharing' | 'shared' | 'error';
  channel?: ShareChannel;
  message?: string;
}

const QR_SIZE = 6;

function buildQrPattern(seed: string) {
  const bytes = Array.from(seed).map((char) => char.charCodeAt(0));
  const cells = QR_SIZE * QR_SIZE;
  return Array.from({ length: cells }).map((_, idx) => {
    const byte = bytes[idx % bytes.length] ?? 0;
    return (byte + idx) % 3 !== 0;
  });
}

export function SharePanel({ clinicianId, shortLink = 'https://vital.passport/ava' }: SharePanelProps) {
  const [copied, setCopied] = useState(false);
  const [routingOrg, setRoutingOrg] = useState('nci:va');
  const [shareStatus, setShareStatus] = useState<ShareStatusState>({ status: 'idle' });
  const qrPattern = useMemo(() => buildQrPattern(clinicianId), [clinicianId]);

  const logShareEvent = useCallback(
    async (channel: ShareChannel) => {
      setShareStatus({ status: 'sharing', channel, message: 'Syncing with timeline…' });
      try {
        const response = await fetch('/api/demo/clinician/passport/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clinicianId, channel, shortLink, routingOrg }),
        });

        if (!response.ok) {
          throw new Error(`Share API returned ${response.status}`);
        }

        setShareStatus({
          status: 'shared',
          channel,
          message: channel === 'nci-federation' ? 'Sent via NCI federation' : 'Ready to scan or copy',
        });
      } catch (error) {
        console.error('[SharePanel] failed to log timeline event', error);
        setShareStatus({
          status: 'error',
          channel,
          message: 'Timeline logging failed — saved locally only.',
        });
      }
    },
    [clinicianId, routingOrg, shortLink],
  );

  const handleCopy = useCallback(async () => {
    if (!navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(shortLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      logShareEvent('short-link');
    } catch (error) {
      console.warn('[SharePanel] copy failed', error);
    }
  }, [logShareEvent, shortLink]);

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-4 w-4" aria-hidden="true" />
          Share passport
        </CardTitle>
        <CardDescription>QR scan, short link, or federated send through NCI.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">QR payload</p>
            <Badge variant="outline">Device bound</Badge>
          </div>
          <div
            role="img"
            aria-label="QR code representing the selective disclosure payload"
            className="rounded-xl bg-white p-3 shadow-inner"
          >
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${QR_SIZE}, minmax(0, 1fr))` }}>
              {qrPattern.map((isDark, idx) => (
                <span
                  /* eslint-disable-next-line react/no-array-index-key */
                  key={idx}
                  className={`aspect-square rounded-sm ${isDark ? 'bg-neutral-900' : 'bg-neutral-200'}`}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => logShareEvent('qr')}>
            <QrCode className="mr-2 h-4 w-4" aria-hidden="true" />
            Mark QR as shared
          </Button>
        </section>

        <section className="space-y-2">
          <label htmlFor="passport-short-link" className="text-sm font-medium">
            Short link
          </label>
          <div className="flex gap-2">
            <Input id="passport-short-link" value={shortLink} readOnly className="font-mono text-sm" />
            <Button variant="outline" onClick={handleCopy} aria-live="polite">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-emerald-600" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="text-sm font-medium">Federated send (NCI)</p>
          <div className="space-y-2">
            <label htmlFor="nci-routing" className="text-xs text-muted-foreground">
              Route to
            </label>
            <select
              id="nci-routing"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              value={routingOrg}
              onChange={(event) => setRoutingOrg(event.target.value)}
            >
              <option value="nci:va">Org B / Veterans Affairs</option>
              <option value="nci:ochn">Org B / Oceanview Health Network</option>
              <option value="nci:sutter">Org B / Sutter Mobility Pilot</option>
            </select>
          </div>
          <Button className="w-full" onClick={() => logShareEvent('nci-federation')}>
            <SendHorizonal className="mr-2 h-4 w-4" aria-hidden="true" />
            Send via NCI routing
          </Button>
        </section>

        <div
          role="status"
          className="rounded-lg border border-dashed p-3 text-sm"
          aria-live="polite"
        >
          <p className="font-medium flex items-center gap-2">
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Timeline sync
          </p>
          <p className="text-muted-foreground">
            {shareStatus.status === 'idle'
              ? 'No share recorded yet.'
              : shareStatus.message ?? 'Share telemetry captured.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default SharePanel;

