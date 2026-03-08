'use client';

/**
 * TypedConsole.tsx — Wave 169: Interaction Engine
 *
 * An operator-grade typewriter console component.
 * Types sequences of lines with configurable speed, then optionally loops.
 *
 * Features:
 *   - Per-line typing delay (configurable)
 *   - Blinking cursor
 *   - Line prefix (prompt character)
 *   - Color-coded line types: info | success | warn | error | muted
 *   - Scrolls to latest line automatically
 *   - Pause/resume on hover
 *
 * Usage:
 *   <TypedConsole lines={[...]} typeSpeed={28} />
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ConsoleLine = {
  text: string;
  kind?: 'info' | 'success' | 'warn' | 'error' | 'muted' | 'command';
  /** Delay before this line starts typing (ms). Default: 0 */
  preDelay?: number;
};

interface TypedConsoleProps {
  lines: ConsoleLine[];
  /** ms per character (default: 22) */
  typeSpeed?: number;
  /** Loop when all lines typed (default: false) */
  loop?: boolean;
  /** Pause between loops (ms) */
  loopDelay?: number;
  /** Show prompt prefix (default: '>') */
  prompt?: string;
  /** Max visible lines (scroll older lines out) */
  maxVisible?: number;
  className?: string;
}

const KIND_COLOR: Record<NonNullable<ConsoleLine['kind']>, string> = {
  info:    'text-blue-400',
  success: 'text-emerald-400',
  warn:    'text-amber-400',
  error:   'text-red-400',
  muted:   'text-zinc-600',
  command: 'text-violet-400',
};

const KIND_PREFIX: Record<NonNullable<ConsoleLine['kind']>, string> = {
  info:    '  ',
  success: '✓ ',
  warn:    '⚠ ',
  error:   '✗ ',
  muted:   '  ',
  command: '$ ',
};

export default function TypedConsole({
  lines,
  typeSpeed = 22,
  loop = false,
  loopDelay = 2000,
  prompt = '>',
  maxVisible = 12,
  className = '',
}: TypedConsoleProps) {
  const [completedLines, setCompletedLines] = useState<ConsoleLine[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [lineIdx, setLineIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [paused, setPaused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLine = lines[lineIdx];

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Reset when lines change
  useEffect(() => {
    setCompletedLines([]);
    setCurrentText('');
    setLineIdx(0);
    setCharIdx(0);
    setDone(false);
  }, [lines]);

  // Type engine
  useEffect(() => {
    if (paused || !currentLine) return;

    clearTimer();

    if (done) {
      if (loop) {
        timerRef.current = setTimeout(() => {
          setCompletedLines([]);
          setCurrentText('');
          setLineIdx(0);
          setCharIdx(0);
          setDone(false);
        }, loopDelay);
      }
      return;
    }

    // Pre-delay before a line
    if (charIdx === 0 && currentLine.preDelay) {
      timerRef.current = setTimeout(() => setCharIdx(0), currentLine.preDelay);
      // We need to not re-enter immediately — use a flag
    }

    const target = currentLine.text;

    if (charIdx < target.length) {
      timerRef.current = setTimeout(() => {
        setCurrentText(target.slice(0, charIdx + 1));
        setCharIdx((c) => c + 1);
      }, charIdx === 0 ? (currentLine.preDelay ?? 0) + typeSpeed : typeSpeed);
    } else {
      // Line complete
      timerRef.current = setTimeout(() => {
        setCompletedLines((prev) => {
          const next = [...prev, currentLine];
          return next.length > maxVisible ? next.slice(next.length - maxVisible) : next;
        });
        setCurrentText('');
        setCharIdx(0);
        const nextIdx = lineIdx + 1;
        if (nextIdx >= lines.length) {
          setDone(true);
        } else {
          setLineIdx(nextIdx);
        }
      }, typeSpeed * 3);
    }

    return clearTimer;
  }, [charIdx, lineIdx, currentLine, done, loop, loopDelay, paused, typeSpeed, maxVisible, lines.length, clearTimer]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [completedLines, currentText]);

  return (
    <div
      className={`relative rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/70">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-3 type-code text-zinc-600 text-[11px]">
          vitalcv — trust console
        </span>
        {paused && <span className="ml-auto text-[10px] text-zinc-600">paused</span>}
      </div>

      {/* Console body */}
      <div className="p-4 max-h-64 overflow-y-auto space-y-1 font-mono text-[12px] leading-relaxed">
        <AnimatePresence initial={false}>
          {completedLines.map((line, i) => {
            const kind = line.kind ?? 'info';
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`flex items-start gap-1 ${KIND_COLOR[kind]}`}
              >
                <span className="shrink-0 text-zinc-700">{prompt}</span>
                <span className="shrink-0">{KIND_PREFIX[kind]}</span>
                <span>{line.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Current typing line */}
        {currentLine && !done && (
          <div className={`flex items-start gap-1 ${KIND_COLOR[currentLine.kind ?? 'info']}`}>
            <span className="shrink-0 text-zinc-700">{prompt}</span>
            <span className="shrink-0">{KIND_PREFIX[currentLine.kind ?? 'info']}</span>
            <span>
              {currentText}
              <span className="inline-block w-[7px] h-[13px] bg-current ml-0.5 animate-pulse align-text-bottom" />
            </span>
          </div>
        )}

        {done && (
          <div className="flex items-center gap-1 text-zinc-700">
            <span>{prompt}</span>
            <span className="inline-block w-[7px] h-[13px] bg-zinc-700 ml-0.5 animate-pulse align-text-bottom" />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
