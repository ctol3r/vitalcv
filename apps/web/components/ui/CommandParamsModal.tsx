'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

export interface CommandParamsModalProps {
  commandName: string;
  schemaInfo: Record<string, any>;
  initialData: any;
  onClose: () => void;
  onSubmit: (payload: any) => void;
}

export function CommandParamsModal({ commandName, schemaInfo, initialData, onClose, onSubmit }: CommandParamsModalProps) {
  const [formData, setFormData] = useState<any>(initialData || {});

  const handleFieldChange = (key: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const fields = Object.entries(schemaInfo);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-[rgba(240,238,233,0.88)] backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-[var(--vt-surface)] border border-[var(--vt-border)] shadow-2xl shadow-stone-950/10 p-6"
      >
        <div className="mb-6 border-b border-[var(--vt-border)] pb-4">
          <h2 className="text-xl font-bold text-[var(--vt-text-primary)] flex items-center gap-2">
            <span className="text-indigo-700">⚡</span>
            {commandName}
          </h2>
          <p className="text-sm text-[var(--vt-text-secondary)] mt-1">Please provide missing parameters to execute this action.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(([key, info]) => (
            <div key={key} className="flex flex-col">
              <label className="text-sm font-medium text-[var(--vt-text-primary)] mb-1 flex justify-between">
                {key} {info.isOptional ? <span className="text-xs text-[var(--vt-text-muted)]">Optional</span> : <span className="text-xs text-rose-600">*</span>}
              </label>

              <input
                type={info.type === 'number' ? 'number' : 'text'}
                value={formData[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                placeholder={info.description || `Enter ${key}...`}
                className="rounded-lg bg-white border border-[var(--vt-border)] p-2.5 text-[var(--vt-text-primary)] outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-[var(--vt-text-muted)] focus:bg-[var(--vt-surface)]"
                required={!info.isOptional}
              />
              {info.description && <span className="text-xs text-[var(--vt-text-muted)] mt-1">{info.description}</span>}
            </div>
          ))}

          <div className="pt-4 flex items-center justify-end gap-3 mt-8 border-t border-[var(--vt-border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--vt-text-secondary)] hover:bg-[var(--vt-surface-subtle)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg text-sm font-bold bg-emerald-700 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-700/20 transition-all hover:shadow-emerald-700/40 active:scale-95"
            >
              Execute Command
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
