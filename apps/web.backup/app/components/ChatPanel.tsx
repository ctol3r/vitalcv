"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ChatThread {
  id: string;
  contextType: string; // 'credential' | 'job' | 'verification' | 'general'
  contextId?: string;
  messages: any[]; // Placeholder
}

interface ChatPanelProps {
  threadId?: string;
  contextType?: string;
  contextId?: string;
}

export default function ChatPanel({ threadId, contextType, contextId }: ChatPanelProps) {
  const router = useRouter();
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const baseUrl = process.env.NEXT_PUBLIC_AGENT_BASE || "http://localhost:4000";

  // Fetch thread or create one
  useEffect(() => {
    if (!contextType && !threadId) return;

    const fetchThread = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${baseUrl}/api/assistant/thread`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contextType, contextId })
            });
            if (res.ok) {
                const data = await res.json();
                setThread(data.thread);
                setSummary(data.summary);
                // In a real app, we'd also fetch messages here
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    fetchThread();
  }, [threadId, contextType, contextId]);

  const handleJumpToContext = () => {
    if (!thread) return;

    if (thread.contextType === 'credential' && thread.contextId) {
      router.push(`/credentials/${thread.contextId}`);
    } else if (thread.contextType === 'job' && thread.contextId) {
      router.push(`/jobs/${thread.contextId}`);
    } else if (thread.contextType === 'verification' && thread.contextId) {
      router.push(`/verifications/${thread.contextId}`);
    }
  };

  const handleSuggestion = async (action: string) => {
    // Optimistic update
    const newMsg = { role: 'user', content: action };
    setMessages(prev => [...prev, newMsg]);

    try {
        const res = await fetch(`${baseUrl}/api/assistant/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: action, contextId })
        });
        if (res.ok) {
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        }
    } catch (e) {
        console.error(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white border-l w-80 shadow-lg">
      <div className="p-4 border-b bg-gray-50">
        <h2 className="font-semibold text-gray-800">Assistant</h2>
        {summary && <p className="text-xs text-gray-500 mt-1">{summary}</p>}

        {/* Task 50.4: Jump to Context */}
        {thread?.contextType && thread.contextType !== 'general' && (
          <button
            onClick={handleJumpToContext}
            className="text-xs text-blue-600 hover:underline mt-2 flex items-center"
          >
            Open {thread.contextType.charAt(0).toUpperCase() + thread.contextType.slice(1)}
            <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && <div className="text-center text-gray-500 text-sm">Loading...</div>}

        {messages.map((msg, idx) => (
           <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
             <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {msg.content}
             </div>
           </div>
        ))}

        {/* Task 50.5: AI Follow-up suggestions */}
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant' && (
            <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 mb-2">Suggestions:</div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => handleSuggestion("Explain this credential")} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors">
                    Explain this credential
                    </button>
                    <button onClick={() => handleSuggestion("Check status")} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors">
                    Check status
                    </button>
                    <button onClick={() => handleSuggestion("Suggest next step")} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors">
                    Suggest next step
                    </button>
                </div>
            </div>
        )}

        {messages.length === 0 && !loading && (
             <div className="mt-4">
             <div className="text-xs font-medium text-gray-500 mb-2">Start with:</div>
             <div className="flex flex-wrap gap-2">
                 <button onClick={() => handleSuggestion("Explain this credential")} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors">
                 Explain this credential
                 </button>
                 <button onClick={() => handleSuggestion("Check status")} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 border border-blue-100 transition-colors">
                 Check status
                 </button>
             </div>
         </div>
        )}
      </div>

      <div className="p-4 border-t">
          <div className="relative">
            <input
                type="text"
                placeholder="Type a message..."
                className="w-full border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        handleSuggestion(e.currentTarget.value);
                        e.currentTarget.value = '';
                    }
                }}
            />
            <button className="absolute right-2 top-1/2 transform -translate-y-1/2 text-blue-600 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </div>
      </div>
    </div>
  );
}

