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
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-6"
      >
        <div className="mb-6 border-b border-slate-800 pb-4">
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <span className="text-indigo-400">⚡</span>
            {commandName}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Please provide missing parameters to execute this action.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {fields.map(([key, info]) => (
            <div key={key} className="flex flex-col">
              <label className="text-sm font-medium text-slate-300 mb-1 flex justify-between">
                {key} {info.isOptional ? <span className="text-xs text-slate-500">Optional</span> : <span className="text-xs text-rose-500">*</span>}
              </label>

              <input
                type={info.type === 'number' ? 'number' : 'text'}
                value={formData[key] || ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                placeholder={info.description || `Enter ${key}...`}
                className="rounded-lg bg-slate-800 border border-slate-700 p-2.5 text-slate-200 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-600 focus:bg-slate-900"
                required={!info.isOptional}
              />
              {info.description && <span className="text-xs text-slate-500 mt-1">{info.description}</span>}
            </div>
          ))}

          <div className="pt-4 flex items-center justify-end gap-3 mt-8 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/40 active:scale-95"
            >
              Execute Command
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
