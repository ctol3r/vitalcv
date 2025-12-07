'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ChainAnchorModal } from '@/components/timeline/ChainAnchorModal';
import {
  CheckCircle,
  AlertTriangle,
  Clock,
  Shield,
  Link as LinkIcon,
  FileCheck,
  Ban,
  Activity
} from 'lucide-react';

// Types
interface TimelineEvent {
  id: string;
  type: 'ISSUANCE' | 'VERIFICATION' | 'REVOCATION' | 'MONITORING' | 'ANCHORING';
  title: string;
  description?: string;
  timestamp: string; // ISO date string
  status: 'completed' | 'pending' | 'failed' | 'warning';
  txHash?: string;
  blockNumber?: number;
  metadata?: Record<string, any>;
}

interface LifecycleData {
  credential: any;
  timeline: TimelineEvent[];
  chainAnchors: TimelineEvent[];
}

export default function CredentialTimelinePage() {
  const params = useParams();
  const credentialId = params.id as string;
  const [data, setData] = useState<LifecycleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnchor, setSelectedAnchor] = useState<TimelineEvent | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/lifecycle/${credentialId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!credentialId) return;
    fetchData();

    // WebSocket Integration
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/lifecycle?credentialId=${credentialId}`;
    // Note: In a real environment, ensure the WS server is correctly addressed.
    // If running via Next.js dev server, it might proxy to backend.

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Connected to lifecycle updates');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'credential:update' && msg.credentialId === credentialId) {
            fetchData();
        }
      } catch (e) {
        // ignore
      }
    };

    return () => {
      ws.close();
    };
  }, [credentialId]);

  if (loading) {
    return <div className="p-8 text-center">Loading timeline...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center">Credential not found or error loading data.</div>;
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'ISSUANCE': return <FileCheck className="h-5 w-5 text-blue-500" />;
      case 'VERIFICATION': return <Shield className="h-5 w-5 text-green-500" />;
      case 'REVOCATION': return <Ban className="h-5 w-5 text-red-500" />;
      case 'ANCHORING': return <LinkIcon className="h-5 w-5 text-purple-500" />;
      case 'MONITORING': return <Activity className="h-5 w-5 text-orange-500" />;
      default: return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getBadge = (event: TimelineEvent) => {
    if (event.type === 'ANCHORING' && event.txHash) {
      return (
        <button
          onClick={() => setSelectedAnchor(event)}
          className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200"
        >
          On-Chain
        </button>
      );
    }
    if (event.status === 'completed') {
        return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Verified</span>;
    }
    if (event.status === 'failed') {
        return <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Failed</span>;
    }
    if (event.type === 'ISSUANCE') {
        const badges = [
            <span key="issued" className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Issued</span>
        ];

        if (data?.credential?.expiresAt) {
             const expires = new Date(data.credential.expiresAt);
             const now = new Date();
             const diffDays = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
             if (diffDays > 0 && diffDays <= 30) {
                 badges.push(
                    <span key="expiring" className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Expiring soon</span>
                 );
             }
        }
        return <>{badges}</>;
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Credential Lifecycle</h1>

      <div className="relative border-l-2 border-gray-200 dark:border-gray-700 ml-3 space-y-8 pb-8">
        {data.timeline.map((event) => (
          <div key={event.id} className="relative flex items-start pl-8">
            {/* Icon Bubble */}
            <div className="absolute -left-[9px] top-0 bg-white dark:bg-gray-900 p-1 rounded-full border border-gray-200 dark:border-gray-700">
               {getIcon(event.type)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {new Date(event.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
              </div>

              <div className="mt-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center flex-wrap gap-2">
                  {event.title}
                  {getBadge(event)}
                </h3>

                {event.description && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {event.description}
                  </p>
                )}

                {event.metadata && Object.keys(event.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 p-2 rounded overflow-x-auto">
                        <pre>{JSON.stringify(event.metadata, null, 2)}</pre>
                    </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedAnchor && (
        <ChainAnchorModal
          isOpen={!!selectedAnchor}
          onClose={(open) => !open && setSelectedAnchor(null)}
          txHash={selectedAnchor.txHash}
          blockNumber={selectedAnchor.blockNumber}
          anchoredHash={selectedAnchor.metadata?.anchoredHash || selectedAnchor.metadata?.hash}
          rpcUrl={selectedAnchor.metadata?.rpcUrl}
        />
      )}
    </div>
  );
}

