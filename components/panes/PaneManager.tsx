'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';

type Pane = { key: string; title: string; content: React.ReactNode; width?: number };
type PaneCtx = {
  push: (p: Omit<Pane, 'key'> & { key?: string }) => void;
  pop: (key?: string) => void;
  clear: () => void;
  stack: Pane[];
};
const Ctx = createContext<PaneCtx | null>(null);
export function usePanes() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePanes must be used within PaneProvider');
  return ctx;
}

export function PaneProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<Pane[]>([]);

  const value = useMemo(
    () => ({
      push(p: Omit<Pane, 'key'> & { key?: string }) {
        const key = p.key ?? `${Date.now()}-${Math.random()}`;
        setStack((s) => [...s, { key, width: 520, ...p }]);
      },
      pop(key?: string) {
        setStack((s) => (key ? s.filter((p) => p.key !== key) : s.slice(0, -1)));
      },
      clear() {
        setStack([]);
      },
      stack,
    }),
    [stack],
  );

  return (
    <Ctx.Provider value={value}>
      <div className="relative h-full w-full overflow-hidden">
        <div className={clsx('h-full', stack.length ? 'pr-2 md:pr-4' : '')}>{children}</div>
        {stack.length > 0 && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] md:bg-transparent md:backdrop-blur-0"
            onClick={() => value.pop()}
          />
        )}
        <div className="pointer-events-none fixed inset-y-0 right-0 flex">
          <AnimatePresence initial={false}>
            {stack.map((pane, i) => (
              <PaneSlide
                key={pane.key}
                index={i}
                total={stack.length}
                {...pane}
                onClose={() => value.pop(pane.key)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </Ctx.Provider>
  );
}

function PaneSlide({
  title,
  content,
  width = 520,
  index,
  total,
  onClose,
}: {
  title: string;
  content: React.ReactNode;
  width?: number;
  index: number;
  total: number;
  onClose: () => void;
}) {
  const offset = Math.max(0, (total - 1 - index) * 12);
  return (
    <motion.div
      className="pointer-events-auto h-full border-l border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
      style={{ width }}
      initial={{ x: width + offset, opacity: 0.9 }}
      animate={{ x: offset, opacity: 1 }}
      exit={{ x: width + offset, opacity: 0.8 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
    >
      <div className="flex h-12 items-center justify-between border-b border-neutral-200 px-4 dark:border-neutral-800">
        <div className="font-medium">{title}</div>
        <button
          className="rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="h-[calc(100%-3rem)] overflow-auto">{content}</div>
    </motion.div>
  );
}

