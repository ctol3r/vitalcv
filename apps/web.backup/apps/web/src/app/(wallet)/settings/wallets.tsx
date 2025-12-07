'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Link2,
  LockKeyhole,
  RefreshCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useIsMobile } from '@/components/ui/use-mobile';
import { cn } from '@/lib/utils';
import { getCredentials, type Credential } from '@/lib/wallet-api';

interface WalletProfile {
  id: string;
  walletType: string;
  walletHandle?: string | null;
  createdAt: string;
}

interface IssuerProfile {
  profile_id: string;
  vc_type: string;
  disclosure: string;
  min_assurance: string;
  trust_service_id?: string;
}

interface WalletSettingsResponse {
  clinicianId: string;
  wallets: WalletProfile[];
  issuerProfiles: IssuerProfile[];
}

interface PasskeyRecord {
  id: string;
  clinicianId: string;
  name: string;
  transports: string[];
  createdAt: string;
  lastVerifiedAt?: string;
}

interface PasskeyResponse {
  clinicianId: string;
  passkeys: PasskeyRecord[];
}

interface EudiLinkState {
  profileId: string;
  progress: 'idle' | 'linking';
  error?: string | null;
}

export default function WalletSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [wallets, setWallets] = useState<WalletProfile[]>([]);
  const [issuerProfiles, setIssuerProfiles] = useState<IssuerProfile[]>([]);
  const [passkeys, setPasskeys] = useState<PasskeyRecord[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | undefined>();
  const [linkState, setLinkState] = useState<EudiLinkState | null>(null);
  const [deviceLabel, setDeviceLabel] = useState('');
  const isCompact = useIsMobile();

  useEffect(() => {
    void bootstrap();
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      setLoading(true);
      await Promise.all([refreshWallets(), refreshPasskeys(), refreshCredentials()]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshWallets = useCallback(async () => {
    const response = await fetch('/api/wallet/settings/wallets');
    if (!response.ok) {
      throw new Error('Failed to load wallet settings');
    }
    const data = (await response.json()) as WalletSettingsResponse;
    setWallets(data.wallets);
    setIssuerProfiles(data.issuerProfiles ?? []);
  }, []);

  const refreshPasskeys = useCallback(async () => {
    const response = await fetch('/api/wallet/settings/passkeys');
    if (!response.ok) {
      throw new Error('Failed to load passkeys');
    }
    const data = (await response.json()) as PasskeyResponse;
    setPasskeys(data.passkeys ?? []);
  }, []);

  const refreshCredentials = useCallback(async () => {
    const rows = await getCredentials();
    setCredentials(rows);
    if (!selectedCredentialId && rows.length > 0) {
      setSelectedCredentialId(rows[0].id);
    }
  }, [selectedCredentialId]);

  const recentPasskey = useMemo(() => {
    const now = Date.now();
    return passkeys.find((pk) => {
      if (!pk.lastVerifiedAt) return false;
      return now - Date.parse(pk.lastVerifiedAt) < 5 * 60 * 1000;
    });
  }, [passkeys]);

  const handleEnrollPasskey = useCallback(async () => {
    setError(null);
    setStatus(null);
    setEnrolling(true);
    try {
      const response = await fetch('/api/wallet/settings/passkeys/enroll/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requireDeviceBound: true }),
      });
      if (!response.ok) {
        throw new Error('Failed to start passkey enrollment');
      }
      const { challengeId, options } = await response.json();
      const attestation = (await navigator.credentials.create({
        publicKey: decodeCreationOptions(options),
      })) as PublicKeyCredential;
      const payload = {
        challengeId,
        credential: serializeAttestation(attestation),
        deviceName: deviceLabel || undefined,
      };
      const finish = await fetch('/api/wallet/settings/passkeys/enroll/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!finish.ok) {
        const details = await finish.json().catch(() => ({}));
        throw new Error(details?.message ?? 'Passkey enrollment failed');
      }
      setStatus('Passkey enrolled successfully.');
      setDeviceLabel('');
      await refreshPasskeys();
    } catch (err) {
      console.error('[wallet][passkeys][enroll]', err);
      setError(err instanceof Error ? err.message : 'Failed to enroll passkey');
    } finally {
      setEnrolling(false);
    }
  }, [deviceLabel, refreshPasskeys]);

  const handleVerifyPasskey = useCallback(async () => {
    setError(null);
    setStatus(null);
    setVerifying(true);
    try {
      const response = await fetch('/api/wallet/settings/passkeys/verify/start', { method: 'POST' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.message ?? 'Failed to start verification');
      }
      const { challengeId, options } = await response.json();
      const assertion = (await navigator.credentials.get({
        publicKey: decodeRequestOptions(options),
      })) as PublicKeyCredential;
      const payload = {
        challengeId,
        credentialId: assertion.id,
        response: serializeAssertion(assertion),
      };
      const finish = await fetch('/api/wallet/settings/passkeys/verify/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!finish.ok) {
        const details = await finish.json().catch(() => ({}));
        throw new Error(details?.message ?? 'Verification failed');
      }
      setStatus('Passkey verified and wallet binding unlocked.');
      await refreshPasskeys();
    } catch (err) {
      console.error('[wallet][passkeys][verify]', err);
      setError(err instanceof Error ? err.message : 'Passkey verification failed');
    } finally {
      setVerifying(false);
    }
  }, [refreshPasskeys]);

  const handleLinkProfile = useCallback(
    async (profile: IssuerProfile) => {
      if (!selectedCredentialId) {
        setError('Select a credential to link into your wallet.');
        return;
      }
      if (!recentPasskey) {
        setError('Verify a passkey before linking an EUDI wallet.');
        return;
      }
      setLinkState({ profileId: profile.profile_id, progress: 'linking' });
      setError(null);
      setStatus(null);
      try {
        const response = await fetch('/api/wallet/settings/wallets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletType: 'EUDI',
            profileId: profile.profile_id,
            credentialId: selectedCredentialId,
            passkeyId: recentPasskey.id,
            provider: 'EUDI Wallet',
          }),
        });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(
            details?.report?.errors?.[0]?.message ??
              details?.message ??
              'Failed to link wallet profile',
          );
        }
        setStatus(`Linked ${profile.profile_id} to your EUDI wallet.`);
        await refreshWallets();
      } catch (err) {
        console.error('[wallet][link]', err);
        setError(err instanceof Error ? err.message : 'Wallet linking failed');
      } finally {
        setLinkState(null);
      }
    },
    [recentPasskey, refreshWallets, selectedCredentialId],
  );

  const renderPasskeys = () => {
    if (passkeys.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-6 text-sm text-muted-foreground">
          <KeyRound className="h-10 w-10 opacity-60" />
          <p>No passkeys enrolled yet.</p>
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {passkeys.map((pk) => (
          <div
            key={pk.id}
            className="flex flex-wrap items-center justify-between rounded-md border border-dashed px-3 py-2 text-sm"
          >
            <div>
              <div className="font-medium">{pk.name}</div>
              <div className="text-xs text-muted-foreground">
                Added {new Date(pk.createdAt).toLocaleDateString()}
                {pk.lastVerifiedAt && (
                  <>
                    {' · '}Verified {new Date(pk.lastVerifiedAt).toLocaleTimeString()}
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pk.lastVerifiedAt ? (
                <Badge variant="secondary" className="gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Bound
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Unverified
                </Badge>
              )}
              {recentPasskey?.id === pk.id && (
                <Badge className="gap-1 bg-emerald-600 text-white">Ready</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWallets = () => {
    if (wallets.length === 0) {
      return (
        <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
          <Wallet className="h-12 w-12 opacity-60" />
          <p>No wallets linked yet.</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="flex flex-wrap items-center justify-between rounded-md border px-4 py-3"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {wallet.walletType}
                <Badge variant="outline" className="text-xs">
                  {wallet.walletHandle ?? 'Device-bound'}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Linked {new Date(wallet.createdAt).toLocaleString()}
              </div>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Link2 className="h-3.5 w-3.5" />
              Connected
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Wallet · Settings</Badge>
          {recentPasskey ? (
            <Badge className="gap-1 bg-emerald-600 text-white">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Passkey ready
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-amber-600">
              <LockKeyhole className="h-3.5 w-3.5" />
              Passkey required
            </Badge>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Wallet linking & security</h1>
        <p className="text-sm text-muted-foreground">
          Manage passkeys, connect your EUDI wallet, and export Apple or Google wallet credentials.
        </p>
        {status && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4" />
            <span>{status}</span>
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full md:col-span-2" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5" />
                Passkey enrollment
              </CardTitle>
              <CardDescription>
                Register a passkey on this device to unlock wallet linking and device-bound issuance.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[1fr,auto]">
                <Input
                  placeholder="Device label (e.g., iPhone 15)"
                  value={deviceLabel}
                  onChange={(event) => setDeviceLabel(event.target.value)}
                  disabled={enrolling}
                />
                <Button onClick={handleEnrollPasskey} disabled={enrolling}>
                  {enrolling ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Enroll passkey
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleVerifyPasskey}
                disabled={verifying || passkeys.length === 0}
              >
                {verifying ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Verify passkey & unlock linking
              </Button>
              {renderPasskeys()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Linked wallets
              </CardTitle>
              <CardDescription>
                Track which wallet providers have been bound to your VitalCV identity.
              </CardDescription>
            </CardHeader>
            <CardContent>{renderWallets()}</CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                EUDI wallet profiles
              </CardTitle>
              <CardDescription>
                Select a credential and link it into your EUDI-compliant wallet using selective disclosure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Tabs defaultValue="credentials" className="w-full">
                <TabsList className={cn('grid', isCompact ? 'grid-cols-2' : 'grid-cols-3')}>
                  <TabsTrigger value="credentials">Credentials</TabsTrigger>
                  <TabsTrigger value="profiles">Issuer profiles</TabsTrigger>
                  <TabsTrigger value="link">Link wallet</TabsTrigger>
                </TabsList>
                <TabsContent value="credentials" className="mt-4 space-y-3">
                  {credentials.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No credentials detected yet. Issue a credential from your wallet tab first.
                    </p>
                  ) : (
                    credentials.map((credential) => (
                      <label
                        key={credential.id}
                        className={cn(
                          'flex cursor-pointer items-center justify-between rounded-md border px-4 py-3 text-sm',
                          selectedCredentialId === credential.id && 'border-indigo-500 bg-indigo-50',
                        )}
                      >
                        <div>
                          <div className="font-semibold">{credential.type}</div>
                          <div className="text-xs text-muted-foreground">
                            Issued {new Date(credential.issuedAt).toLocaleDateString()}
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="credential"
                          value={credential.id}
                          checked={selectedCredentialId === credential.id}
                          onChange={() => setSelectedCredentialId(credential.id)}
                        />
                      </label>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="profiles" className="mt-4 space-y-3">
                  {issuerProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No issuer profiles available yet. Try refreshing the page.
                    </p>
                  ) : (
                    issuerProfiles.map((profile) => (
                      <div key={profile.profile_id} className="rounded-md border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{profile.profile_id}</div>
                            <div className="text-xs text-muted-foreground">{profile.vc_type}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {profile.disclosure.toUpperCase()} · {profile.min_assurance}
                          </Badge>
                        </div>
                        {profile.trust_service_id && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Trust service: {profile.trust_service_id}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </TabsContent>
                <TabsContent value="link" className="mt-4 space-y-4">
                  {issuerProfiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nothing to link yet — issuer directory still syncing.
                    </p>
                  ) : (
                    issuerProfiles.map((profile) => (
                      <div
                        key={`link-${profile.profile_id}`}
                        className="flex flex-wrap items-center justify-between rounded-md border px-4 py-3"
                      >
                        <div>
                          <div className="text-sm font-semibold">{profile.profile_id}</div>
                          <div className="text-xs text-muted-foreground">
                            {profile.vc_type} · {profile.disclosure.toUpperCase()}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          disabled={linkState?.progress === 'linking' && linkState.profileId === profile.profile_id}
                          onClick={() => handleLinkProfile(profile)}
                        >
                          {linkState?.progress === 'linking' && linkState.profileId === profile.profile_id ? (
                            <>
                              <RefreshCcw className="mr-2 h-4 w-4 animate-spin" />
                              Linking…
                            </>
                          ) : (
                            <>
                              <Link2 className="mr-2 h-4 w-4" />
                              Link profile
                            </>
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                  <p className="text-xs text-muted-foreground">
                    Linking requires a freshly verified passkey so we can anchor a wallet binding event.
                  </p>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function decodeCreationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64UrlDecode(options.challenge),
    user: {
      ...options.user,
      id: base64UrlDecode(options.user.id),
    },
  };
}

function decodeRequestOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64UrlDecode(options.challenge),
    allowCredentials: (options.allowCredentials ?? []).map((cred: any) => ({
      ...cred,
      id: base64UrlDecode(cred.id),
    })),
  };
}

function serializeAttestation(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAttestationResponse;
  return {
    id: credential.id,
    type: credential.type,
    rawId: base64UrlEncode(credential.rawId),
    transports: (credential as any).transports ?? [],
    response: {
      clientDataJSON: base64UrlEncode(response.clientDataJSON),
      attestationObject: response.attestationObject
        ? base64UrlEncode(response.attestationObject)
        : undefined,
      publicKey: response.getPublicKey ? base64UrlEncode(response.getPublicKey()!) : undefined,
    },
  };
}

function serializeAssertion(credential: PublicKeyCredential) {
  const response = credential.response as AuthenticatorAssertionResponse;
  return {
    clientDataJSON: base64UrlEncode(response.clientDataJSON),
    authenticatorData: response.authenticatorData
      ? base64UrlEncode(response.authenticatorData)
      : undefined,
    signature: response.signature ? base64UrlEncode(response.signature) : undefined,
  };
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  const base64 = pad ? padded + '='.repeat(4 - pad) : padded;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

