"use client";
import { useEffect, useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE?.replace('/api/agent', '') || 'http://localhost:4000';

export default function SCIMAdmin() {
  const [users, setUsers] = useState<any[]>([]);
  const [bearerToken] = useState('sample-token-123');

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${BASE}/scim/v2/Users`);
        const data = await response.json();
        setUsers(data.Resources || []);
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  return (
    <div className='max-w-4xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-bold mb-6'>SCIM 2.0 User Provisioning</h1>

      <div className='mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg'>
        <h3 className='font-semibold mb-2'>SCIM Configuration</h3>
        <div className='text-sm space-y-1'>
          <p><strong>Base URL:</strong> {BASE}/scim/v2</p>
          <p><strong>Bearer Token:</strong> <code className='bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded'>{bearerToken}</code></p>
        </div>
      </div>

      <h2 className='text-xl font-semibold mb-4'>Provisioned Users ({users.length})</h2>
      <div className='space-y-2'>
        {users.length === 0 ? (
          <p className='text-gray-500'>No users provisioned via SCIM</p>
        ) : (
          users.map((user) => (
            <div key={user.id} className='p-3 bg-white dark:bg-gray-800 border rounded-lg'>
              <p className='font-medium'>{user.name?.formatted}</p>
              <p className='text-sm text-gray-600 dark:text-gray-400'>{user.userName}</p>
              <span className={`text-xs px-2 py-1 rounded ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {user.active ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
