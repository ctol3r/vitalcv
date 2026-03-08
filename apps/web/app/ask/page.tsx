'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Shield, FileText, Building2 } from 'lucide-react';

const EXAMPLE_QUESTIONS = [
  'Am I cleared for California locums cardiology?',
  'Show employers hiring L3 ICU nurses near Sacramento.',
  "What's missing before I can start at Kaiser?",
  'Which organizations accept telehealth psychiatry with DEA active?',
];

const SOURCE_BADGES = [
  { icon: FileText,  label: 'Trust State',    color: 'text-vt-success' },
  { icon: Building2, label: 'Employer Pages',  color: 'text-vt-info' },
  { icon: Shield,    label: 'Issuer Registry', color: 'text-vt-warning' },
];

export default function AskPage() {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-ops-gradient text-white surface-operator">

      {/* Header */}
      <div className="border-b border-vt-neutral-800 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="heading-md text-white">Ask VitalCV</h1>
            <p className="body-sm mt-0.5 text-vt-neutral-200">
              Powered by Trust Intelligence · Source-backed answers only
            </p>
          </div>
          <div className="flex items-center gap-2">
            {SOURCE_BADGES.map(({ icon: Icon, label, color }) => (
              <span key={label} className={`flex items-center gap-1.5 rounded-full vt-glass px-3 py-1 tag ${color}`}>
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto max-w-3xl">

          {/* Empty state */}
          <div className="py-20 text-center">
            <Sparkles className="mx-auto mb-4 h-10 w-10 text-vt-neutral-800" />
            <p className="heading-md text-vt-neutral-100">Ask me anything about credentialing.</p>
            <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">
              I can help you understand your trust state, find matching opportunities,
              or explain what any employer requires from you.
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {EXAMPLE_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="rounded-xl vt-glass p-4 text-left body-sm text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-white transition"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/20 p-4 text-center">
              <p className="tag text-vt-neutral-800">
                AI answers coming soon · Guardrails: no answers without sources · no unauthorized disclosures
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Input bar */}
      <div className="border-t border-vt-neutral-800 bg-vt-surface-ops-base px-6 py-4">
        <form
          onSubmit={(e) => e.preventDefault()}
          className="mx-auto flex max-w-3xl items-center gap-3"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about credentialing, opportunities, or requirements..."
            className="flex-1 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 px-5 py-3.5 body text-white placeholder:text-vt-neutral-800 focus:border-vt-info/60 focus:outline-none focus:ring-1 focus:ring-vt-info/30 transition"
            aria-label="Ask a question"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-vt-info disabled:opacity-40 hover:bg-vt-info/90 transition"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </form>
      </div>
    </div>
  );
}
