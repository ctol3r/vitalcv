"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function SSOEnterprise() {
  const [config, setConfig] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: '',
  });

  const handleSave = async () => {
    try {
      await fetch(`${BASE}/sso/oidc/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      alert('SSO configuration saved');
    } catch {
      alert('Failed to save SSO configuration');
    }
  };

  return (
    <div className='max-w-3xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>Enterprise SSO Configuration</h1>

      <div className='space-y-4'>
        <div>
          <label className='block text-sm font-medium mb-1'>Client ID</label>
          <input
            type='text'
            value={config.client_id}
            onChange={(e) => setConfig({ ...config, client_id: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-800'
            placeholder='your-client-id'
          />
        </div>

        <div>
          <label className='block text-sm font-medium mb-1'>Client Secret</label>
          <input
            type='password'
            value={config.client_secret}
            onChange={(e) => setConfig({ ...config, client_secret: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-800'
            placeholder='your-client-secret'
          />
        </div>

        <div>
          <label className='block text-sm font-medium mb-1'>Redirect URI</label>
          <input
            type='text'
            value={config.redirect_uri}
            onChange={(e) => setConfig({ ...config, redirect_uri: e.target.value })}
            className='w-full p-2 border rounded dark:bg-gray-800'
            placeholder='https://your-app.com/callback'
          />
        </div>

        <button
          onClick={handleSave}
          className='px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'
        >
          Save Configuration
        </button>
      </div>

      <div className='mt-8 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded'>
        <h3 className='font-semibold mb-2'>Endpoints</h3>
        <div className='text-sm space-y-1'>
          <p><strong>Authorize:</strong> {BASE}/sso/oidc/authorize</p>
          <p><strong>Token:</strong> {BASE}/sso/oidc/token</p>
          <p><strong>UserInfo:</strong> {BASE}/sso/oidc/userinfo</p>
        </div>
      </div>
    </div>
  );
}
