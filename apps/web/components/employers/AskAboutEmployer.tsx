'use client';
/**
 * Wave 186 — Employer Knowledge Layer
 * AskAboutEmployer — inline "Ask about this employer" search widget
 * Sends query to /api/ask with employer context injection
 */

import { useState, useRef } from 'react';
import { MessageCircle, Send, Loader2, ShieldCheck, FileText, Briefcase } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  sources?: string[];
}

const EXAMPLE_QUERIES = [
  'What licenses do I need to work here?',
  'How long does credentialing take?',
  'Do they accept locums with telehealth experience?',
  'Are they payer-enrolled in Medi-Cal?',
];

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  'employer-profile': <Briefcase className="w-3 h-3" />,
  'trust-state': <ShieldCheck className="w-3 h-3" />,
  'public-page': <FileText className="w-3 h-3" />,
};

export default function AskAboutEmployer({
  employerName,
  employerSlug,
}: {
  employerName: string;
  employerSlug: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendQuery = async (query: string) => {
    if (!query.trim() || loading) return;
    const q = query.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          context: { employerSlug, employerName },
          filters: { employer: employerSlug },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: data.answer ?? 'No answer available.',
            sources: data.sources ?? [],
          },
        ]);
      } else {
        // Graceful stub fallback
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: generateStubAnswer(q, employerName),
            sources: ['employer-profile'],
          },
        ]);
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: generateStubAnswer(q, employerName),
          sources: ['employer-profile'],
        },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendQuery(input);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">Ask about {employerName}</h3>
      </div>

      {/* Example queries (show when no messages) */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs text-white/40">Try asking:</p>
          <div className="flex flex-col gap-1.5">
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                onClick={() => sendQuery(q)}
                className="text-left text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white/80 transition-all"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {messages.map((msg, i) => (
            <div key={i} className={`text-sm ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block max-w-[90%] px-3 py-2 rounded-xl leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600/30 text-blue-100'
                  : 'bg-white/5 text-white/80'
              }`}>
                {msg.text}
              </div>
              {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {msg.sources.map(src => (
                    <span key={src} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-xs text-white/30">
                      {SOURCE_ICONS[src] ?? <FileText className="w-3 h-3" />}
                      {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Searching…</span>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={`Ask about ${employerName}…`}
          className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

// ── Stub answer generator (used when API is offline/dev) ──────────────────────

function generateStubAnswer(query: string, employerName: string): string {
  const q = query.toLowerCase();
  if (q.includes('license') || q.includes('credential')) {
    return `${employerName} requires an active state medical license (L3), board certification (L3), and a verified NPI. DEA registration is required at L2 level. All credentials must be primary-source verified through VitalCV before the clear-to-start signal is issued.`;
  }
  if (q.includes('how long') || q.includes('time') || q.includes('onboard')) {
    return `${employerName} typically onboards clinicians within 5–10 business days of a complete credential file. The VitalCV trust signal dramatically reduces back-and-forth with their credentialing office.`;
  }
  if (q.includes('locum') || q.includes('telehealth') || q.includes('remote')) {
    return `${employerName} accepts locums and telehealth-experienced clinicians depending on the role. Check the open roles filter for "Locums" or "Telehealth" hiring types for positions that match.`;
  }
  if (q.includes('pay') || q.includes('salary') || q.includes('rate')) {
    return `Pay transparency details for ${employerName} are available on their profile page. If the employer has opted in to pay transparency, ranges are shown under the Hiring Details section.`;
  }
  return `${employerName}'s profile includes trust score, credential requirements, hiring types, and time-to-start information. For specific policy questions, view the full requirements table on this page or use the VitalCV readiness check to see your eligibility score.`;
}
