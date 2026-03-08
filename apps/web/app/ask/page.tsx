'use client';

import { Building2, ExternalLink, FileText, Loader2, Send, Shield, ShieldAlert, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const EXAMPLE_QUESTIONS = [
  'Am I cleared for California locums cardiology?',
  'Show employers hiring L3 ICU nurses near Sacramento.',
  "What's missing before I can start at Kaiser?",
  'Which organizations accept telehealth psychiatry with DEA active?',
];

interface SourceBadge  { type: string; label: string; color: string; url?: string }
interface SuggestedAction { label: string; href: string; reason: string }
interface AskResponse  {
  query: string; intent: string; answer: string;
  sources: SourceBadge[]; suggestedActions: SuggestedAction[];
  noResults: boolean; guardrailTriggered: boolean; durationMs: number;
}

interface Message {
  role:     'user' | 'assistant';
  content:  string;
  response?: AskResponse;
}

const SOURCE_ICONS: Record<string, typeof Shield> = {
  TRUST_STATE_SUMMARY: Shield,
  EMPLOYER_PROFILE:    Building2,
  OPPORTUNITY:         Sparkles,
  FAQ_DOC:             FileText,
  default:             FileText,
};

export default function AskPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const inputRef  = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (q: string) => {
    if (!q.trim() || loading) return;
    setInput('');
    setLoading(true);
    setMessages((m) => [...m, { role: 'user', content: q }]);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q }),
      });
      const data: AskResponse = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: data.answer, response: data }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-ops-gradient text-white surface-operator">

      {/* Header */}
      <div className="border-b border-vt-neutral-800 px-6 py-5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="heading-md text-white">Ask VitalCV</h1>
            <p className="body-sm mt-0.5 text-vt-neutral-200">Source-backed answers · Labor market only · No PHI</p>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            {[{ icon: FileText, label: 'Trust State', color: 'text-vt-success' }, { icon: Building2, label: 'Employer Pages', color: 'text-vt-info' }, { icon: Shield, label: 'Issuer Registry', color: 'text-vt-warning' }].map(({ icon: Icon, label, color }) => (
              <span key={label} className={`flex items-center gap-1.5 rounded-full vt-glass px-3 py-1 tag ${color}`}>
                <Icon className="h-3 w-3" />{label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-3xl space-y-6">

          {messages.length === 0 && (
            <div className="py-16 text-center">
              <Sparkles className="mx-auto mb-4 h-10 w-10 text-vt-neutral-800" />
              <p className="heading-md text-vt-neutral-100">Ask me anything about credentialing.</p>
              <p className="body-sm mx-auto mt-2 max-w-md text-vt-neutral-200">I answer only from indexed, source-backed VitalCV data — no guesswork.</p>
              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button key={q} onClick={() => send(q)}
                    className="rounded-xl vt-glass p-4 text-left body-sm text-vt-neutral-200 hover:bg-vt-surface-ops-raised hover:text-white transition">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'user' ? (
                <div className="max-w-xl rounded-3xl rounded-br-sm bg-vt-surface-ops-raised shadow-[0_4px_20px_rgba(0,0,0,0.1)] px-5 py-4 border border-vt-neutral-800">
                  <p className="body text-white">{msg.content}</p>
                </div>
              ) : (
                <div className="max-w-3xl w-full space-y-2">
                  {/* Answer */}
                  <div className={`rounded-3xl rounded-tl-sm px-6 py-5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] ${msg.response?.guardrailTriggered ? 'border border-vt-danger/20 bg-vt-danger/5' : 'border border-vt-neutral-800/80 bg-vt-surface-ops-raised/60'}`}>
                    {msg.response?.guardrailTriggered && (
                      <div className="mb-3 flex items-center gap-2 rounded-full bg-vt-danger/10 px-3 py-1.5 w-max tag text-vt-danger ring-1 ring-vt-danger/20">
                        <ShieldAlert className="h-4 w-4" /> Guardrail triggered
                      </div>
                    )}
                    <p className="body-lg text-white leading-relaxed">{msg.content}</p>

                    {/* Sources */}
                    {msg.response?.sources && msg.response.sources.length > 0 && (
                      <div className="mt-5 rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-base p-4">
                        <p className="label mb-3 text-vt-neutral-800">Cited Sources</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.response.sources.map((s, idx) => {
                            const Icon = SOURCE_ICONS[s.type] ?? SOURCE_ICONS.default;
                            return (
                              <a href={s.url || '#'} key={s.type + idx} className={`group flex items-center gap-3 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 px-3 py-2 hover:border-vt-neutral-700 transition`}>
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vt-surface-ops-base ring-1 ring-vt-neutral-800 ${s.color}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <p className="truncate text-sm font-medium text-white group-hover:text-vt-info transition-colors">{s.label}</p>
                                  <p className="text-xs text-vt-neutral-200 truncate">{s.type.replace(/_/g, ' ')}</p>
                                </div>
                                {s.url && <ExternalLink className="h-3 w-3 shrink-0 text-vt-neutral-800 group-hover:text-vt-info" />}
                              </a>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Suggested actions block */}
                    {msg.response?.suggestedActions && msg.response.suggestedActions.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-vt-neutral-800/50">
                        <p className="label mb-3 text-vt-neutral-800">Suggested Actions</p>
                        <div className="flex flex-col gap-2">
                          {msg.response.suggestedActions.map((a) => (
                            <a key={a.href} href={a.href} title={a.reason}
                              className="flex items-center justify-between rounded-xl bg-vt-info/10 px-5 py-3 text-vt-info ring-1 ring-vt-info/20 hover:bg-vt-info/20 hover:ring-vt-info/40 transition">
                              <span className="font-medium">{a.label}</span>
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-vt-info/20 transition-transform group-hover:translate-x-1">→</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {msg.response && (
                    <p className="ml-2 tag text-vt-neutral-800">{msg.response.durationMs}ms search · Intent: {msg.response.intent}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm border border-vt-neutral-800 bg-vt-surface-ops-raised/40 px-5 py-4">
                <Loader2 className="h-4 w-4 animate-spin text-vt-neutral-800" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Input */}
      <div className="border-t border-vt-neutral-800 bg-vt-surface-ops-base px-6 py-6">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="relative flex-1">
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about credentialing, opportunities, or requirements..."
              className="w-full rounded-2xl border border-vt-info/20 bg-vt-surface-ops-base shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] px-6 py-4 pr-16 body text-white placeholder:text-vt-neutral-800 focus:border-vt-info focus:outline-none focus:ring-2 focus:ring-vt-info/20 focus:shadow-[0_0_20px_rgba(99,102,241,0.1)] transition-all"
              aria-label="Ask a question" />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send"
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-xl bg-vt-info text-white disabled:opacity-40 hover:bg-vt-info/90 hover:shadow-[0_0_15px_rgba(99,102,241,0.4)] transition-all">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
