'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Mic, Paperclip, Sparkles, Briefcase, BadgeCheck, FileText } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatPanelProps {
  userId?: string;
  orgId?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ userId = 'demo-user', orgId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi! I\'m your VitalCV Assistant. How can I help you with credentials or jobs today?',
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!message.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setMessage('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:4000/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          orgId,
          message: userMsg.content,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();

      const botMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: data.message || 'Sorry, I encountered an error.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I am having trouble connecting to the server right now.',
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-4">
      {/* Chat Window */}
      {isOpen && (
        <div className="w-96 h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden transition-all duration-300 ease-in-out transform origin-bottom-right">
          {/* Header */}
          <div className="bg-primary/5 border-b border-gray-100 dark:border-gray-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">VitalCV Assistant</h3>
                <p className="text-xs text-muted-foreground">Powered by AI</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Context Tags */}
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 flex gap-2 overflow-x-auto scrollbar-hide border-b border-gray-100 dark:border-gray-800">
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 whitespace-nowrap">
              <BadgeCheck className="w-3 h-3" /> Credentials
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-100 whitespace-nowrap">
              <Briefcase className="w-3 h-3" /> Jobs
            </span>
            <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 whitespace-nowrap">
              <FileText className="w-3 h-3" /> Verification
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-black/20">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
            <div className="relative flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about credentials..."
                className="flex-1 bg-gray-50 dark:bg-gray-800 border-0 rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none placeholder:text-gray-400"
              />
              {message.trim() ? (
                <button
                  onClick={handleSend}
                  className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              ) : (
                <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`group relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${
          isOpen
            ? 'bg-gray-900 text-white rotate-90'
            : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-blue-500/25'
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <>
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></span>
          </>
        )}
      </button>
    </div>
  );
};














