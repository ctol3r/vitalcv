'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { CommandParamsModal } from './CommandParamsModal';

// Shared UI components mapped to known commands from the registry for client-side demo
const QUICK_ACTIONS = [
  { id: 'VerifyNpiCommand', label: 'Verify a Clinician',  desc: 'Lookup and verify NPI credentials', icon: '🔍' },
  { id: 'IssueCredentialCommand', label: 'Issue Credential', desc: 'Mint a new credential for a clinician', icon: '🎗️' },
  { id: 'RevokeTrustCommand', label: 'Revoke Trust', desc: 'Invalidate an existing artifact', icon: '🛑' },
  { id: 'ExportNcqaCapsuleCommand', label: 'Export NCQA Capsule', desc: 'Bundle proof data for compliance', icon: '📦' },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Params Modal state
  const [activeCommand, setActiveCommand] = useState<string | null>(null);
  const [commandSchema, setCommandSchema] = useState<Record<string, any> | null>(null);
  const [initialPayload, setInitialPayload] = useState<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((open) => !open);
      } else if (e.key === '/' && !open && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setSearch('');
    }
  }, [open]);

  const runNlpParse = async (text: string) => {
    try {
      setLoading(true);
      const res = await fetch('/api/command/parse', { // Local endpoint matching apps/api/backend layout
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('Parse failed');
      const data = await res.json();

      if (data.isValid) {
        // execute directly
        executeCommand(data.command, data.payload);
      } else {
        // Need more params -> open modal
        setActiveCommand(data.command);
        setInitialPayload(data.payload);
        setCommandSchema(data.schemaInfo);
      }
    } catch (e) {
      console.error(e);
      // Fallback: didn't match NLP, treat as search or ignore
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim()) {
      runNlpParse(search);
    }
  };

  const handleQuickAction = async (commandName: string) => {
    // Treat a click as triggering the parse with no initial info to trigger the dynamic form immediately
    setActiveCommand(commandName);

    try {
      // We ping the parse endpoint just to get the schema out
      const res = await fetch('/api/command/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commandName })
      });
      const data = await res.json();
      setCommandSchema(data.schemaInfo);
      setInitialPayload({});
    } catch (e) {
      console.error(e);
    }
  };

  const executeCommand = async (commandName: string, payload: any) => {
    // Call real execute endpoint
    try {
      const res = await fetch('/api/command/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandName, payload })
      });

      const data = await res.json();
      if (data.success) {
        alert(`Success: ${data.message}\nTxID: ${data.result.transactionId}`);
      } else {
        alert(`Error executing command: ${data.error}`);
      }
    } catch(e) {
      alert("Execution failed.");
    } finally {
      setOpen(false);
      setActiveCommand(null);
    }
  };

  const closeForm = () => {
    setActiveCommand(null);
    setCommandSchema(null);
    setInitialPayload(null);
    setOpen(false);
  };

  return (
    <>
      <AnimatePresence>
        {open && !activeCommand && (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
            >
              <div className="flex items-center px-4 border-b border-slate-800">
                <span className="text-slate-400 mr-2 text-xl">✨</span>
                <input
                  ref={inputRef}
                  className="flex h-16 w-full rounded-md bg-transparent py-3 text-lg outline-none placeholder:text-slate-500 text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Ask the swarm to do something... e.g., 'Verify NPI 1234567890'"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                {loading && <span className="text-xs text-indigo-400 font-bold animate-pulse">THINKING...</span>}
              </div>

              <div className="max-h-[300px] overflow-y-auto p-2">
                {!search && (
                  <div className="px-2 py-4">
                    <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Quick Actions
                    </h3>
                    <div className="space-y-1">
                      {QUICK_ACTIONS.map((action) => (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAction(action.id)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-slate-800 text-slate-200 transition-colors"
                        >
                          <span className="text-xl">{action.icon}</span>
                          <div>
                            <div className="font-medium">{action.label}</div>
                            <div className="text-xs text-slate-500">{action.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {search && !loading && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    Press <kbd className="font-mono bg-slate-800 rounded px-1 border border-slate-700">Enter</kbd> to parse command naturally.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Zod-to-Form Generator Modal */}
      <AnimatePresence>
        {activeCommand && commandSchema && (
          <CommandParamsModal
            commandName={activeCommand}
            schemaInfo={commandSchema}
            initialData={initialPayload}
            onClose={closeForm}
            onSubmit={(payload) => executeCommand(activeCommand, payload)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
