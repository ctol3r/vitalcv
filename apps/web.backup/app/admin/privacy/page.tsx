"use client";
import { useState } from 'react';

const BASE = process.env.NEXT_PUBLIC_AGENT_BASE || '';

export default function PrivacyPage() {
  const [userId, setUserId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function deleteUserData() {
    if (!userId.trim()) {
      setMessage('Please enter a user ID');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const baseUrl = BASE.replace('/api/agent', '');
      const r = await fetch(baseUrl + '/api/privacy/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId })
      });

      const data = await r.json();
      setMessage(JSON.stringify(data, null, 2));
    } catch (error) {
      setMessage('Error: ' + String(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-4">Privacy & Data Deletion</h1>

      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 p-4 rounded mb-6">
        <h2 className="font-semibold mb-2">Data Retention Policy</h2>
        <ul className="text-sm space-y-1">
          <li>• Agent traces: 90 days</li>
          <li>• MCP logs: 365 days</li>
          <li>• User credentials: Indefinite (user-controlled)</li>
        </ul>
      </div>

      <div className="border rounded p-4 mb-4">
        <h2 className="font-semibold mb-3">Delete User Data</h2>
        <div className="flex gap-2 mb-3">
          <input
            className="flex-1 p-2 border rounded dark:bg-gray-800 dark:border-gray-700"
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="Enter user ID"
            disabled={loading}
          />
          <button
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            onClick={deleteUserData}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete Data'}
          </button>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-400">
          Warning: This will permanently delete all data associated with this user ID.
        </p>
      </div>

      {message && (
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded">
          <h3 className="font-semibold mb-2">Response:</h3>
          <pre className="text-xs overflow-auto">{message}</pre>
        </div>
      )}

      <div className="mt-6 text-xs text-gray-600 dark:text-gray-400">
        <p>For privacy-related inquiries, contact: privacy@vitalcv.com</p>
      </div>
    </div>
  );
}

