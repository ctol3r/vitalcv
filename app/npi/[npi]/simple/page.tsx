'use client';

import { lookupNpi } from '@/lib/apiClient';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ClaimStatusBadge } from '@/components/status/ClaimStatusBadge';

export default function NpiProfilePage() {
  const params = useParams<{ npi: string }>();
  const npi = params?.npi || '';
  const [record, setRecord] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rec = await lookupNpi(npi);
        if (mounted) {
          setRecord(rec);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load NPI info.');
      }
    })();
    return () => {
      mounted = false;
    };
  }, [npi]);

  if (error) {
    return <div className="p-6 max-w-3xl mx-auto text-red-600">Error: {error}</div>;
  }
  if (!record) {
    return <div className="p-6 max-w-3xl mx-auto">Loading…</div>;
  }

  const addr = record.addresses?.[0];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
        <strong>Public NPI record</strong> — not verified as your account yet.
      </div>
      <h2 className="text-2xl font-semibold">
        {record.name} <span className="text-gray-500 text-base">({record.npi})</span>
      </h2>
      <div className="my-2">
        <ClaimStatusBadge npi={record.npi} />
      </div>
      <div>
        <h3 className="font-medium mt-4">Specialty</h3>
        <p>
          {record.taxonomyDescription}{' '}
          <span className="text-gray-500">({record.taxonomyCode})</span>
        </p>
      </div>
      {addr && (
        <div>
          <h3 className="font-medium mt-4">Primary Address</h3>
          <p>
            {addr.address1}
            {addr.address2 ? `, ${addr.address2}` : ''}
          </p>
          <p>
            {addr.city}, {addr.state} {addr.postalCode}
          </p>
          {addr.telephoneNumber && <p>Phone: {addr.telephoneNumber}</p>}
        </div>
      )}
      <div className="pt-4">
        <a
          href={`/claim/${record.npi}`}
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-2"
        >
          Claim this profile
        </a>
      </div>
    </div>
  );
}
