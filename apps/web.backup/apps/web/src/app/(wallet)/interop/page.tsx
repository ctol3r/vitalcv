'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Wallet, RefreshCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useRoleUX } from '@/contexts/RoleUXContext';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.API_BASE_URL ||
  '';

const DEMO_CREDENTIAL = {
  id: 'cred_demo',
  type: ['MedicalLicenseCredential'],
  subjectId: 'did:example:clinician',
  issuer: 'did:web:issuer.vitalcv',
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString(),
  payload: {
    credentialSubject: {
      name: 'Dr. Demo Liaison',
      license: { number: 'MD12345', state: 'CA' },
      nhsNumber: '123-456-7890',
    },
    credentialSchema: 'https://schemas.vitalcv.dev/medical-license',
  },
};

const DEMO_PROFILE = {
  defaultFields: {
    identity: ['credentialSubject.name', 'credentialSubject.license.number'],
  },
};

const DEMO_PRESENTATION = {
  vp: {
    selective_disclosure: { frame: ['credentialSubject.name', 'credentialSubject.license.number'] },
    verifiableCredential: [
      {
        credentialSubject: DEMO_CREDENTIAL.payload.credentialSubject,
      },
    ],
  },
};

interface WalletConfig {
  id: string;
  wallet: string;
  schema: Record<string, unknown>;
}

interface SimulationResult {
  wallet: string;
  issued: boolean;
  stored: boolean;
  presented: boolean;
  errors: Array<{ code: string; message: string }>;
}

interface SyncResult {
  wallet: string;
  synced: boolean;
  storageHandle: string | null;
  issues: Array<{ code: string; message: string }>;
}

export default function WalletInteropPage() {
  const { formatError } = useRoleUX();
  const [configs, setConfigs] = useState<WalletConfig[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<SimulationResult[]>([]);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/api/wallet/interop/configs`);
      if (!response.ok) {
        throw new Error(`Interop configs failed (${response.status})`);
      }
      const payload = (await response.json()) as { configs: WalletConfig[] };
      setConfigs(payload.configs);
      setSelected(payload.configs.slice(0, 2).map((cfg) => cfg.wallet));
    } catch (err) {
      console.error('[wallet][interop] configs load failed', err);
      setError(formatError('wallet_config_failed', err instanceof Error ? err.message : 'Unable to load configs'));
    } finally {
      setLoading(false);
    }
  }, [formatError]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const runSimulation = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/wallet/interop/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          credential: DEMO_CREDENTIAL,
          profile: DEMO_PROFILE,
          presentation: DEMO_PRESENTATION,
          wallets: selected,
        }),
      });
      if (!response.ok) {
        throw new Error(`Simulation failed (${response.status})`);
      }
      const payload = (await response.json()) as { results: SimulationResult[] };
      setSimulation(payload.results);
    } catch (err) {
      console.error('[wallet][interop] simulation failed', err);
      setError(formatError('wallet_sim_failed', err instanceof Error ? err.message : 'Unable to run simulation'));
    }
  }, [selected, formatError]);

  const syncWalletSelection = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/wallet/interop/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          credential: DEMO_CREDENTIAL,
          profile: DEMO_PROFILE,
          presentation: DEMO_PRESENTATION,
          wallets: selected,
        }),
      });
      if (!response.ok) {
        throw new Error(`Sync failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        syncResults: SyncResult[];
        adapters: Record<string, unknown>;
      };
      setSyncResults(payload.syncResults);
    } catch (err) {
      console.error('[wallet][interop] sync failed', err);
      setError(formatError('wallet_sync_failed', err instanceof Error ? err.message : 'Unable to sync wallets'));
    }
  }, [selected, formatError]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 py-8 px-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary" className="gap-2">
            <Wallet className="h-3.5 w-3.5" />
            Wallet interoperability v5
          </Badge>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={loadConfigs} disabled={loading}>
              <RefreshCcw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
              Refresh configs
            </Button>
            <Button variant="secondary" size="sm" onClick={runSimulation} disabled={!selected.length}>
              Run simulation
            </Button>
            <Button onClick={syncWalletSelection} disabled={!selected.length}>
              Sync wallets
            </Button>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">Select & sync wallets</h1>
          <p className="text-sm text-muted-foreground">
            NHS + Apple + Google + EUDI adapters with SD-JWT compatibility and selective disclosure policies.
          </p>
        </div>
        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {error}
          </div>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Wallet configurations</CardTitle>
          <CardDescription>Select the wallets you want to test and sync for this clinician.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {configs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet configs stored yet.</p>
          ) : (
            configs.map((config) => (
              <label key={config.id} className="flex cursor-pointer items-center gap-3 rounded border p-3 text-sm">
                <Checkbox
                  checked={selected.includes(config.wallet)}
                  onCheckedChange={(checked) => {
                    setSelected((prev) =>
                      checked ? [...prev, config.wallet] : prev.filter((wallet) => wallet !== config.wallet),
                    );
                  }}
                />
                <div>
                  <p className="font-semibold">{config.wallet}</p>
                  <p className="text-xs text-muted-foreground">
                    Fields {Object.keys(config.schema ?? {}).length} · version {config.schema.version ?? '1'}
                  </p>
                </div>
              </label>
            ))
          )}
        </CardContent>
      </Card>

      {simulation.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Multi-wallet test runner</CardTitle>
            <CardDescription>Issuance → storage → presentation across selected wallets.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {simulation.map((result) => (
              <div key={result.wallet} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-semibold">{result.wallet}</p>
                  {result.errors.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {result.errors.map((error) => error.message).join(', ')}
                    </p>
                  )}
                </div>
                <Badge variant={result.issued && result.presented ? 'outline' : 'destructive'}>
                  {result.issued ? 'Pass' : 'Fail'}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {syncResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Select-and-sync results</CardTitle>
            <CardDescription>Storage handles and SD-JWT compatibility per wallet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {syncResults.map((result) => (
              <div key={result.wallet} className="flex items-center justify-between rounded border p-3">
                <div>
                  <p className="font-semibold">{result.wallet}</p>
                  <p className="text-xs text-muted-foreground">
                    {result.synced ? 'Synced successfully' : result.issues.map((issue) => issue.message).join(', ')}
                  </p>
                </div>
                {result.synced ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    {result.storageHandle?.slice(0, 18)}…
                  </div>
                ) : (
                  <Badge variant="destructive">Failed</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

