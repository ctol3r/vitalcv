'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Shield, FileText, Building2, ShieldAlert, Loader2, ExternalLink } from 'lucide-react';

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
                <div className="max-w-xl rounded-2xl rounded-br-sm bg-vt-surface-ops-raised/60 px-5 py-3.5 vt-glass">
                  <p className="body text-white">{msg.content}</p>
                </div>
              ) : (
                <div className="max-w-2xl w-full space-y-3">
                  {/* Answer */}
                  <div className={`rounded-2xl rounded-bl-sm px-5 py-4 ${msg.response?.guardrailTriggered ? 'border border-vt-danger/20 bg-vt-danger/5' : 'border border-vt-neutral-800 bg-vt-surface-ops-raised/40'}`}>
                    {msg.response?.guardrailTriggered && (
                      <div className="mb-2 flex items-center gap-2 tag text-vt-danger">
                        <ShieldAlert className="h-3.5 w-3.5" /> Guardrail triggered
                      </div>
                    )}
                    <p className="body text-vt-neutral-100 leading-relaxed">{msg.content}</p>
                  </div>

                  {/* Sources */}
                  {msg.response?.sources && msg.response.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.response.sources.map((s) => {
                        const Icon = SOURCE_ICONS[s.type] ?? SOURCE_ICONS.default;
                        return (
                          <span key={s.type} className={`flex items-center gap-1.5 rounded-full vt-glass px-3 py-1 tag ${s.color}`}>
                            <Icon className="h-3 w-3" />
                            {s.label}
                            {s.url && <ExternalLink className="h-2.5 w-2.5 opacity-60" />}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Suggested actions */}
                  {msg.response?.suggestedActions && msg.response.suggestedActions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.response.suggestedActions.map((a) => (
                        <a key={a.href} href={a.href} title={a.reason}
                          className="rounded-full bg-vt-success/10 px-4 py-1.5 tag text-vt-success ring-1 ring-vt-success/20 hover:bg-vt-success/20 transition">
                          {a.label} →
                        </a>
                      ))}
                    </div>
                  )}

                  {msg.response && (
                    <p className="tag text-vt-neutral-800">{msg.response.durationMs}ms · Intent: {msg.response.intent}</p>
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
      <div className="border-t border-vt-neutral-800 bg-vt-surface-ops-base px-6 py-4">
        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mx-auto flex max-w-3xl items-center gap-3">
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about credentialing, opportunities, or requirements..."
            className="flex-1 rounded-xl border border-vt-neutral-800 bg-vt-surface-ops-raised/50 px-5 py-3.5 body text-white placeholder:text-vt-neutral-800 focus:border-vt-info/60 focus:outline-none focus:ring-1 focus:ring-vt-info/30 transition"
            aria-label="Ask a question" />
          <button type="submit" disabled={!input.trim() || loading} aria-label="Send"
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-vt-info disabled:opacity-40 hover:bg-vt-info/90 transition">
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-white" /> : <Send className="h-4 w-4 text-white" />}
          </button>
        </form>
      </div>
    </div>
  );
}
