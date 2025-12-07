'use client';

import { useMemo, useState } from 'react';
import { requestAttestation, startBasicClaim, uploadDocuments, verifyPin } from '@/lib/apiClient';

type Step = 1 | 2 | 3;

export default function ClaimWizard({ npi, onClose }: { npi: string; onClose: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Step 1 state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const validEmail = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), [email]);
  // Step 2 state
  const [files, setFiles] = useState<File[]>([]);

  const sendOTP = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      await startBasicClaim(npi, email, phone || undefined);
      setMsg('Verification code sent. Check your inbox.');
    } catch (e: any) {
      setErr(e?.message || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      await verifyPin(npi, pin);
      setMsg('Email verified! Proceeding to identity verification…');
      setTimeout(() => {
        setStep(2);
        setMsg(null);
      }, 800);
    } catch (e: any) {
      setErr(e?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const doUpload = async () => {
    if (!files.length) {
      setErr('Select at least one PDF or image.');
      return;
    }
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      await uploadDocuments(npi, files);
      setMsg('Documents uploaded and verified. Next: issuer attestation.');
      setTimeout(() => {
        setStep(3);
        setMsg(null);
      }, 800);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const doAttest = async () => {
    setLoading(true);
    setErr(null);
    setMsg(null);
    try {
      await requestAttestation(npi);
      setMsg('Attestation requested. A trusted issuer will review.');
    } catch (e: any) {
      setErr(e?.message || 'Attestation request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 text-sm pb-3">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded ${
              s < step ? 'bg-green-500' : s === step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
      {step === 1 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Step 1 — Basic verification</h3>
          <p className="text-sm text-gray-600">We'll send a one-time code to confirm your contact.</p>
          <label className="block text-sm">Email</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <label className="block text-sm">Phone (optional)</label>
          <input
            className="w-full border rounded px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 555 555 5555"
          />
          <button
            disabled={loading || !validEmail}
            onClick={sendOTP}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2"
          >
            {loading ? 'Sending…' : 'Send Code'}
          </button>
          <div className="pt-2">
            <label className="block text-sm">Enter 6-digit code</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              maxLength={6}
              placeholder="123456"
            />
            <button
              disabled={loading || pin.length !== 6}
              onClick={verifyOTP}
              className="mt-2 w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded py-2"
            >
              {loading ? 'Verifying…' : 'Verify Code'}
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Step 2 — Identity verification</h3>
          <p className="text-sm text-gray-600">
            Upload your license/ID and a selfie. Accepted: PDF, JPG, PNG (≤10MB each).
          </p>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          {files.length > 0 && (
            <ul className="text-xs text-gray-600 list-disc pl-4">
              {files.map((f) => (
                <li key={f.name}>
                  {f.name} ({Math.round(f.size / 1024)} KB)
                </li>
              ))}
            </ul>
          )}
          <button
            disabled={loading || files.length === 0}
            onClick={doUpload}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2"
          >
            {loading ? 'Uploading…' : 'Submit documents'}
          </button>
        </section>
      )}
      {step === 3 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">Step 3 — Issuer attestation</h3>
          <p className="text-sm text-gray-600">
            Request a trusted issuer (hospital/board) to attest. We'll notify you when approved.
          </p>
          <button
            disabled={loading}
            onClick={doAttest}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2"
          >
            {loading ? 'Requesting…' : 'Request attestation'}
          </button>
          <p className="text-xs text-gray-500">
            You can close this wizard; your status badge will update automatically.
          </p>
          <button
            onClick={onClose}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 rounded py-2"
          >
            Close
          </button>
        </section>
      )}
      {msg && (
        <p className="mt-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
          {err}
        </p>
      )}
    </div>
  );
}

