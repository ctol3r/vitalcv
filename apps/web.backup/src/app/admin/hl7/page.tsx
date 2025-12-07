
'use client';

import { useState, useEffect } from 'react';

interface HL7Message {
  id: string;
  raw: string;
  parsed: any;
  status: string;
  createdAt: string;
}

export default function HL7Dashboard() {
  const [messages, setMessages] = useState<HL7Message[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Helper to fetch data
  const fetchMessages = async () => {
    setLoading(true);
    try {
      const url = new URL('http://localhost:3001/api/hl7/messages');
      if (filter) {
        url.searchParams.set('status', filter);
      }

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      if (data.ok) {
        setMessages(data.messages);
      }
    } catch (e) {
      console.error(e);
      // In a real app, show a toast
      // alert('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const handleRetry = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:3001/api/hl7/${id}/retry`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      const data = await res.json();
      if (data.ok) {
        alert('Retry successful');
        fetchMessages();
      } else {
        alert('Retry failed: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Error retrying message');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">HL7 Ingestion Dashboard</h1>
        <button
          onClick={fetchMessages}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      <div className="flex gap-4 mb-6 bg-white p-4 rounded shadow-sm border">
        <div className="flex items-center gap-2">
          <label className="font-medium">Status Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="border p-2 rounded bg-gray-50 min-w-[150px]"
          >
            <option value="">All Statuses</option>
            <option value="received">Received</option>
            <option value="parsed">Parsed</option>
            <option value="errored">Errored</option>
          </select>
        </div>
      </div>

      {loading && messages.length === 0 ? (
        <div className="text-center py-10">Loading messages...</div>
      ) : (
        <div className="bg-white rounded shadow overflow-hidden border">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-4 font-medium text-gray-600">ID</th>
                <th className="p-4 font-medium text-gray-600">Status</th>
                <th className="p-4 font-medium text-gray-600">Received At</th>
                <th className="p-4 font-medium text-gray-600">Type</th>
                <th className="p-4 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {messages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">No messages found</td>
                </tr>
              ) : messages.map(msg => (
                <tr key={msg.id} className="hover:bg-gray-50">
                  <td className="p-4 font-mono text-xs text-gray-500">{msg.id}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      msg.status === 'parsed' ? 'bg-green-100 text-green-800' :
                      msg.status === 'errored' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {msg.status}
                    </span>
                  </td>
                  <td className="p-4 text-sm">
                    {new Date(msg.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 text-sm">
                    {msg.parsed?.type ? `${msg.parsed.type}^${msg.parsed.trigger}` : '-'}
                  </td>
                  <td className="p-4 text-sm space-x-2">
                    <button
                      onClick={() => alert('Raw Message:\n\n' + msg.raw)}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Raw
                    </button>
                    <span className="text-gray-300">|</span>
                    <button
                      onClick={() => alert('Parsed Data:\n\n' + JSON.stringify(msg.parsed, null, 2))}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Parsed
                    </button>
                    {msg.status === 'errored' && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button
                          onClick={() => handleRetry(msg.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Retry
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}














