'use client';

/**
 * IssuerOnboardingPanel.tsx — Wave 138: Issuer Onboarding Protocol
 *
 * Allows operators to onboard new credential issuers into the VitalCV network:
 *   - Form: issuerName, issuerDID, verificationEndpoint, trustLevel, federationMetadata
 *   - Submits to POST /api/network/issuer/register
 *   - Live list of onboarded issuers from GET /api/network/issuer
 *   - Trust registry updates reflected immediately on success
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Building,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  XCircle,
} from 'lucide-react';
import { getApiBase } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type TrustLevel = 'AUTHORITATIVE' | 'TRUSTED' | 'UNVERIFIED';

interface FederationMetadata {
  entityStatementEndpoint?: string;
  didMethods?: string;
  oidcFederationEnabled?: boolean;
  federatedNetworkIds?: string;
  notes?: string;
}

interface OnboardedIssuer {
  issuerId: string;
  issuerName: string;
  trustLevel: TrustLevel;
  status: string;
  registeredAt: string;
  trustScore?: number;
  metadata?: {
    verificationEndpoint?: string;
    federationMetadata?: FederationMetadata;
  };
}

interface FormState {
  issuerName: string;
  issuerDID: string;
  verificationEndpoint: string;
  trustLevel: TrustLevel;
  // federation metadata
  entityStatementEndpoint: string;
  didMethods: string;
  oidcFederationEnabled: boolean;
  federatedNetworkIds: string;
  federationNotes: string;
  showFederationFields: boolean;
}

const EMPTY_FORM: FormState = {
  issuerName: '',
  issuerDID: '',
  verificationEndpoint: '',
  trustLevel: 'TRUSTED',
  entityStatementEndpoint: '',
  didMethods: '',
  oidcFederationEnabled: false,
  federatedNetworkIds: '',
  federationNotes: '',
  showFederationFields: false,
};

const TRUST_LEVEL_CONFIG: Record<TrustLevel, { label: string; color: string; score: number }> = {
  AUTHORITATIVE: { label: 'Authoritative', color: 'text-emerald-400', score: 90 },
  TRUSTED: { label: 'Trusted', color: 'text-blue-400', score: 75 },
  UNVERIFIED: { label: 'Unverified', color: 'text-zinc-400', score: 50 },
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function FormField({
  label,
  id,
  required,
  children,
  hint,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-[11px] font-medium text-zinc-400">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600">{hint}</p>}
    </div>
  );
}

function IssuerRow({ issuer }: { issuer: OnboardedIssuer }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TRUST_LEVEL_CONFIG[issuer.trustLevel] ?? TRUST_LEVEL_CONFIG.TRUSTED;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors"
      >
        <Building className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-zinc-200 truncate block">{issuer.issuerName}</span>
          <span className="text-[9px] font-mono text-zinc-600 truncate block">{issuer.issuerId}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
          <span className="text-[10px] text-zinc-600">{issuer.trustScore ?? cfg.score}</span>
          {expanded ? (
            <ChevronUp className="h-3 w-3 text-zinc-600" />
          ) : (
            <ChevronDown className="h-3 w-3 text-zinc-600" />
          )}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-1 border-t border-zinc-800/60 space-y-1.5 text-[10px]">
              {issuer.metadata?.verificationEndpoint && (
                <div className="flex gap-2">
                  <span className="text-zinc-600 w-28 shrink-0">Verification URL</span>
                  <a
                    href={issuer.metadata.verificationEndpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline truncate"
                  >
                    {issuer.metadata.verificationEndpoint}
                  </a>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-zinc-600 w-28 shrink-0">Registered</span>
                <span className="text-zinc-400">
                  {new Date(issuer.registeredAt).toLocaleString()}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-zinc-600 w-28 shrink-0">Status</span>
                <span className={issuer.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                  {issuer.status}
                </span>
              </div>
              {issuer.metadata?.federationMetadata && (
                <div className="mt-2 rounded bg-zinc-800/50 p-2 space-y-1">
                  <p className="text-zinc-500 font-medium flex items-center gap-1">
                    <Globe className="h-2.5 w-2.5" /> Federation Metadata
                  </p>
                  {issuer.metadata.federationMetadata.oidcFederationEnabled && (
                    <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      <CheckCircle className="h-2.5 w-2.5" /> OIDC Federation enabled
                    </span>
                  )}
                  {issuer.metadata.federationMetadata.notes && (
                    <p className="text-zinc-500 italic">{issuer.metadata.federationMetadata.notes}</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function IssuerOnboardingPanel({
  onIssuerRegistered,
}: {
  onIssuerRegistered?: () => void;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [issuers, setIssuers] = useState<OnboardedIssuer[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const apiBase = getApiBase();

  const fetchIssuers = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${apiBase}/api/network/issuer`);
      if (res.ok) {
        const data = await res.json() as { issuers: OnboardedIssuer[] };
        setIssuers(data.issuers ?? []);
      }
    } catch {
      // silently fail list refresh
    } finally {
      setLoadingList(false);
    }
  }, [apiBase]);

  useEffect(() => {
    fetchIssuers();
  }, [fetchIssuers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload: {
      issuerName: string;
      issuerDID: string;
      verificationEndpoint: string;
      trustLevel: TrustLevel;
      federationMetadata?: object;
    } = {
      issuerName: form.issuerName.trim(),
      issuerDID: form.issuerDID.trim(),
      verificationEndpoint: form.verificationEndpoint.trim(),
      trustLevel: form.trustLevel,
    };

    // Build federation metadata only if any field is filled
    const hasFed =
      form.entityStatementEndpoint ||
      form.didMethods ||
      form.federatedNetworkIds ||
      form.federationNotes ||
      form.oidcFederationEnabled;

    if (hasFed) {
      payload.federationMetadata = {
        ...(form.entityStatementEndpoint ? { entityStatementEndpoint: form.entityStatementEndpoint.trim() } : {}),
        ...(form.didMethods ? { didMethods: form.didMethods.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
        oidcFederationEnabled: form.oidcFederationEnabled,
        ...(form.federatedNetworkIds
          ? { federatedNetworkIds: form.federatedNetworkIds.split(',').map((s) => s.trim()).filter(Boolean) }
          : {}),
        ...(form.federationNotes ? { notes: form.federationNotes.trim() } : {}),
      };
    }

    try {
      const res = await fetch(`${apiBase}/api/network/issuer/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json() as {
        issuerId?: string;
        message?: string;
        error?: string;
      };

      if (res.ok) {
        setSuccessMsg(`✓ Issuer registered: ${data.issuerId}`);
        setForm(EMPTY_FORM);
        setShowForm(false);
        await fetchIssuers();
        onIssuerRegistered?.();
      } else {
        setErrorMsg(data.error ?? 'Registration failed');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field: keyof FormState, value: FormState[keyof FormState]) => {
    setForm((p) => ({ ...p, [field]: value }));
  };

  const inputClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors';

  const selectClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-500 transition-colors';

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-semibold text-zinc-200">Issuer Onboarding</span>
          {!loadingList && (
            <span className="text-[10px] font-mono text-zinc-600">
              {issuers.length} issuer{issuers.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchIssuers}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm((p) => !p);
              setSuccessMsg(null);
              setErrorMsg(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-400 hover:bg-blue-500/20 transition-colors"
          >
            <Plus className="h-3 w-3" />
            New Issuer
          </button>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Success / error toasts */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400"
            >
              <CheckCircle className="h-3.5 w-3.5 shrink-0" />
              {successMsg}
            </motion.div>
          )}
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400"
            >
              <XCircle className="h-3.5 w-3.5 shrink-0" />
              {errorMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onboarding form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <form
                onSubmit={handleSubmit}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4"
              >
                <h3 className="text-sm font-medium text-zinc-200 mb-2">Register New Issuer</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Issuer Name" id="issuerName" required>
                    <input
                      id="issuerName"
                      type="text"
                      required
                      placeholder="e.g. CA Medical Board"
                      value={form.issuerName}
                      onChange={(e) => set('issuerName', e.target.value)}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField
                    label="Issuer DID"
                    id="issuerDID"
                    required
                    hint="Will be normalized to did:vitalcv:issuer: if not a full DID"
                  >
                    <input
                      id="issuerDID"
                      type="text"
                      required
                      placeholder="did:web:example.com or short-id"
                      value={form.issuerDID}
                      onChange={(e) => set('issuerDID', e.target.value)}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Verification Endpoint" id="verificationEndpoint" required>
                    <input
                      id="verificationEndpoint"
                      type="url"
                      required
                      placeholder="https://credentials.example.com/verify"
                      value={form.verificationEndpoint}
                      onChange={(e) => set('verificationEndpoint', e.target.value)}
                      className={inputClass}
                    />
                  </FormField>

                  <FormField label="Trust Level" id="trustLevel" required>
                    <select
                      id="trustLevel"
                      value={form.trustLevel}
                      onChange={(e) => set('trustLevel', e.target.value as TrustLevel)}
                      className={selectClass}
                    >
                      <option value="AUTHORITATIVE">Authoritative (score: 90)</option>
                      <option value="TRUSTED">Trusted (score: 75)</option>
                      <option value="UNVERIFIED">Unverified (score: 50)</option>
                    </select>
                    <div className="mt-1 flex items-center gap-1">
                      <Award className={`h-2.5 w-2.5 ${TRUST_LEVEL_CONFIG[form.trustLevel].color}`} />
                      <span className={`text-[10px] ${TRUST_LEVEL_CONFIG[form.trustLevel].color}`}>
                        {TRUST_LEVEL_CONFIG[form.trustLevel].label} — base trust score {TRUST_LEVEL_CONFIG[form.trustLevel].score}
                      </span>
                    </div>
                  </FormField>
                </div>

                {/* Federation metadata toggle */}
                <div>
                  <button
                    type="button"
                    onClick={() => set('showFederationFields', !form.showFederationFields)}
                    className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    <Globe className="h-3 w-3" />
                    Federation Metadata (optional)
                    {form.showFederationFields ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </button>

                  <AnimatePresence>
                    {form.showFederationFields && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800">
                          <FormField
                            label="Entity Statement Endpoint"
                            id="entityStatementEndpoint"
                            hint="OIDC Federation entity statement URL"
                          >
                            <input
                              id="entityStatementEndpoint"
                              type="url"
                              placeholder="https://federation.example.com/.well-known/openid-federation"
                              value={form.entityStatementEndpoint}
                              onChange={(e) => set('entityStatementEndpoint', e.target.value)}
                              className={inputClass}
                            />
                          </FormField>

                          <FormField
                            label="DID Methods"
                            id="didMethods"
                            hint="Comma-separated: did:web, did:ion, etc."
                          >
                            <input
                              id="didMethods"
                              type="text"
                              placeholder="did:web, did:vitalcv"
                              value={form.didMethods}
                              onChange={(e) => set('didMethods', e.target.value)}
                              className={inputClass}
                            />
                          </FormField>

                          <FormField
                            label="Federated Network IDs"
                            id="federatedNetworkIds"
                            hint="Comma-separated network IDs"
                          >
                            <input
                              id="federatedNetworkIds"
                              type="text"
                              placeholder="nursys, caqh"
                              value={form.federatedNetworkIds}
                              onChange={(e) => set('federatedNetworkIds', e.target.value)}
                              className={inputClass}
                            />
                          </FormField>

                          <FormField label="Notes" id="federationNotes">
                            <input
                              id="federationNotes"
                              type="text"
                              placeholder="Optional notes about federation setup"
                              value={form.federationNotes}
                              onChange={(e) => set('federationNotes', e.target.value)}
                              className={inputClass}
                            />
                          </FormField>

                          <div className="col-span-full flex items-center gap-2">
                            <input
                              id="oidcFederationEnabled"
                              type="checkbox"
                              checked={form.oidcFederationEnabled}
                              onChange={(e) => set('oidcFederationEnabled', e.target.checked)}
                              className="accent-emerald-500 h-3.5 w-3.5"
                            />
                            <label htmlFor="oidcFederationEnabled" className="text-[11px] text-zinc-400">
                              OIDC Federation enabled
                            </label>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                    className="px-4 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Shield className="h-3.5 w-3.5" />
                    )}
                    Register Issuer
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Issuer list */}
        <div>
          <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">
            Registered Issuers
          </p>
          {loadingList ? (
            <div className="flex items-center gap-2 text-xs text-zinc-600 py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading issuers…
            </div>
          ) : issuers.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-center">
              <Building className="h-6 w-6 text-zinc-700 mx-auto mb-2" />
              <p className="text-[11px] text-zinc-600">No issuers registered yet</p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-2 text-[11px] text-blue-400 hover:underline"
              >
                Register the first issuer →
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {issuers.map((issuer) => (
                <IssuerRow key={issuer.issuerId} issuer={issuer} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
