'use client';

/**
 * GatewayConnections.tsx — Wave 91: Gateway Connection Status Panel
 *
 * Displays connected organizations, their status,
 * and last webhook event.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getApiBase } from '@/lib/api';

interface Connection {
  id: string;
  name: string;
  type: string;
  status: string;
  connectedAt: string;
  lastActivity: string;
  permissions: string[];
}

interface GatewayConnectionsProps {
  className?: string;
}

const STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-400',
  SUSPENDED: 'bg-amber-400',
  REVOKED: 'bg-red-400',
};

export function GatewayConnections({ className = '' }: GatewayConnectionsProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const base = getApiBase();

  useEffect(() => {
    fetch(`${base}/api/network/gateway/connections`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.connections) setConnections(data.connections);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [base]);

  return (
    <div className={`rounded-2xl border border-white/8 bg-slate-900/40 p-6 ${className}`}>
      <h3 className="text-[10px] text-zinc-500 uppercase tracking-wider mb-4 font-mono">
        Network Gateway — Connected Organizations
      </h3>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-zinc-500 mb-2">No organizations connected yet</p>
          <p className="text-[10px] text-zinc-600 font-mono">
            Use POST /api/network/gateway/connect to register
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((conn, i) => (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-800/40 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[conn.status] ?? 'bg-zinc-500'}`} />
                <div>
                  <p className="text-xs text-foreground font-medium">{conn.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono">{conn.type}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-zinc-400 font-mono">{conn.permissions.length} permissions</p>
                <p className="text-[10px] text-zinc-600">
                  Last: {new Date(conn.lastActivity).toLocaleDateString()}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GatewayConnections;
