'use client';

/**
 * CodeBlock — syntax-highlighted code display with copy button.
 * Uses manual token classification for JSON/bash/typescript
 * without requiring a heavy syntax highlighting library.
 */

import { cn } from '@/lib/utils';
import { Check, Copy } from 'lucide-react';
import { useCallback, useState } from 'react';

interface CodeBlockProps {
  code: string;
  language?: 'json' | 'bash' | 'typescript' | 'text';
  title?: string;
  className?: string;
  /** Show line numbers */
  lineNumbers?: boolean;
  /** Max height before scrolling */
  maxHeight?: string;
}

interface TokenSpan {
  text: string;
  type: 'key' | 'string' | 'number' | 'boolean' | 'punctuation' | 'comment' | 'command' | 'plain';
}

const TOKEN_COLORS: Record<TokenSpan['type'], string> = {
  key: 'text-[oklch(0.7_0.12_220)]',
  string: 'text-[oklch(0.7_0.14_155)]',
  number: 'text-[oklch(0.7_0.13_40)]',
  boolean: 'text-[oklch(0.7_0.13_310)]',
  punctuation: 'text-[var(--vt-text-muted)]',
  comment: 'text-[var(--vt-text-muted)] italic',
  command: 'text-[oklch(0.85_0.05_155)]',
  plain: 'text-[var(--vt-text-secondary)]',
};

function tokenizeJSON(code: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const regex =
    /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],:])|(\s+)/g;
  let match: RegExpExecArray | null;
  let lastIndex = 0;

  while ((match = regex.exec(code)) !== null) {
    if (match.index > lastIndex) {
      spans.push({ text: code.slice(lastIndex, match.index), type: 'plain' });
    }

    if (match[1]) {
      spans.push({ text: match[1], type: 'key' });
      spans.push({ text: match[0].slice(match[1].length), type: 'punctuation' });
    } else if (match[2]) {
      spans.push({ text: match[2], type: 'string' });
    } else if (match[3]) {
      spans.push({ text: match[3], type: 'boolean' });
    } else if (match[4]) {
      spans.push({ text: match[4], type: 'number' });
    } else if (match[5]) {
      spans.push({ text: match[5], type: 'punctuation' });
    } else if (match[6]) {
      spans.push({ text: match[6], type: 'plain' });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < code.length) {
    spans.push({ text: code.slice(lastIndex), type: 'plain' });
  }

  return spans;
}

function tokenizeBash(code: string): TokenSpan[] {
  const spans: TokenSpan[] = [];
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (i > 0) spans.push({ text: '\n', type: 'plain' });

    if (line.startsWith('#')) {
      spans.push({ text: line, type: 'comment' });
    } else if (line.startsWith('$') || line.startsWith('>')) {
      spans.push({ text: line[0]!, type: 'punctuation' });
      spans.push({ text: line.slice(1), type: 'command' });
    } else {
      spans.push({ text: line, type: 'plain' });
    }
  }

  return spans;
}

function tokenize(code: string, language: string): TokenSpan[] {
  switch (language) {
    case 'json':
      return tokenizeJSON(code);
    case 'bash':
      return tokenizeBash(code);
    default:
      return [{ text: code, type: 'plain' }];
  }
}

export function CodeBlock({
  code,
  language = 'text',
  title,
  className,
  lineNumbers = false,
  maxHeight = '24rem',
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [code]);

  const tokens = tokenize(code, language);
  const lines = code.split('\n');

  return (
    <div
      className={cn(
        'rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      {(title || language !== 'text') && (
        <div className="flex items-center justify-between border-b border-[var(--vt-border)] px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--vt-text-muted)]/40" />
            <span className="h-2 w-2 rounded-full bg-[var(--vt-text-muted)]/40" />
            <span className="h-2 w-2 rounded-full bg-[var(--vt-text-muted)]/40" />
            {title && (
              <span className="ml-2 text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--vt-text-muted)]">
                {title}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] font-medium text-[var(--vt-text-muted)] hover:text-[var(--vt-text-secondary)] transition-colors"
            aria-label={copied ? 'Copied' : 'Copy code'}
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                Copy
              </>
            )}
          </button>
        </div>
      )}

      {/* Code content */}
      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="p-4 text-[13px] leading-6 font-mono">
          {lineNumbers ? (
            <table className="border-collapse">
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i}>
                    <td className="pr-4 text-right select-none text-[var(--vt-text-muted)]/40 text-[11px] align-top">
                      {i + 1}
                    </td>
                    <td className="whitespace-pre">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <code>
              {tokens.map((token, i) => (
                <span key={i} className={TOKEN_COLORS[token.type]}>
                  {token.text}
                </span>
              ))}
            </code>
          )}
        </pre>
      </div>
    </div>
  );
}

export type { CodeBlockProps };
