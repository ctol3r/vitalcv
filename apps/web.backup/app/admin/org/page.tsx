"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function OrgAdmin() {
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [region, setRegion] = useState('us');
  const [vat, setVat] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const orgId = 'default-org'; // In production, get from session
        const response = await fetch(`${BASE}/api/org/${orgId}`);
        const data = await response.json();
        setOrg(data);
        setMembers(data.members || []);

        // Load VAT info
        const orgResponse = await fetch(`${BASE}/org/${orgId}`);
        const orgData = await orgResponse.json();
        setRegion(orgData.region || 'us');
        setVat(orgData.vat_number || '');
      } catch {
        setOrg({ name: 'Default Organization', members: [] });
      }
    })();
  }, []);

  const saveVatSettings = async () => {
    try {
      const orgId = 'default-org';
      await fetch(`${BASE}/org/${orgId}/vat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, vat_number: vat }),
      });
      alert('VAT settings saved successfully!');
    } catch (error) {
      alert('Failed to save VAT settings');
    }
  };

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Organization Administration</h1>

      {org && (
        <div className='mb-8 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
          <h2 className='text-lg font-semibold mb-2'>{org.name}</h2>
          <p className='text-sm text-gray-600 dark:text-gray-400'>
            Domain: {org.domain || 'N/A'}
          </p>
        </div>
      )}

      {/* VAT Settings */}
      <div className='mb-8 p-4 bg-white dark:bg-gray-800 border rounded-lg'>
        <h2 className='text-lg font-semibold mb-4'>VAT Settings</h2>
        <div className='space-y-3'>
          <div>
            <label className='block text-sm font-medium mb-1'>Region</label>
            <select
              className='w-full p-2 border rounded'
              value={region}
              onChange={e => setRegion(e.target.value)}
            >
              <option value='us'>United States</option>
              <option value='eu'>European Union</option>
              <option value='uk'>United Kingdom</option>
              <option value='ca'>Canada</option>
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium mb-1'>VAT Number</label>
            <input
              className='w-full p-2 border rounded'
              placeholder='VAT number'
              value={vat}
              onChange={e => setVat(e.target.value)}
            />
          </div>
          <button
            onClick={saveVatSettings}
            className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
          >
            Save VAT Settings
          </button>
        </div>
      </div>

      <h2 className='text-xl font-semibold mb-4'>Members</h2>
      <div className='space-y-2'>
        {members.length === 0 ? (
          <p className='text-gray-500'>No members found</p>
        ) : (
          members.map((member) => (
            <div key={member.id} className='p-3 bg-white dark:bg-gray-800 border rounded-lg flex justify-between items-center'>
              <div>
                <p className='font-medium'>{member.name}</p>
                <p className='text-sm text-gray-600 dark:text-gray-400'>{member.email}</p>
              </div>
              <span className='px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 rounded'>
                {member.role}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
