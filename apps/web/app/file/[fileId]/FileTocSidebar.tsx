'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';

import {
  FILE_TOC,
  sectionAnchorId,
  type FileSectionId,
  type FileTocEntry,
} from '@/lib/file/fileMeta';

interface FileTocSidebarProps {
  fileMetaId: string;
}

/**
 * Sticky table-of-contents with IntersectionObserver-driven active
 * highlighting. Rendered as a client component because the
 * IntersectionObserver API only exists in the browser.
 *
 * Honest fallback: when the browser does not support
 * IntersectionObserver (very old browsers), the active section
 * remains the default 'cover' and clicks still scroll to anchors.
 */
export function FileTocSidebar({ fileMetaId }: FileTocSidebarProps) {
  const [activeId, setActiveId] = useState<FileSectionId>('cover');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof IntersectionObserver === 'undefined') return;

    const ids = FILE_TOC.map((t) => sectionAnchorId(t.id));
    const els = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const raw = visible[0].target.id.replace(/^sec-/, '') as FileSectionId;
          setActiveId(raw);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function jumpTo(id: FileSectionId) {
    const el = document.getElementById(sectionAnchorId(id));
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  return (
    <div
      className="rounded-md border border-border bg-card overflow-hidden"
      data-testid="file-toc-sidebar"
      data-active-section={activeId}
    >
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <p className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
          Table of Contents
        </p>
        <p className="mt-0.5 text-[11px] font-mono tabular-nums text-foreground">
          {fileMetaId}
        </p>
      </div>
      <ol>
        {FILE_TOC.map((t: FileTocEntry, i) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => jumpTo(t.id)}
              className={[
                'w-full text-left flex items-baseline gap-2 px-4 py-2 border-l-2 transition-colors',
                i < FILE_TOC.length - 1 ? 'border-b border-border/50' : '',
                activeId === t.id
                  ? 'bg-muted/40 border-l-foreground text-foreground'
                  : 'border-l-transparent hover:bg-muted/20 text-muted-foreground',
              ].join(' ')}
              data-toc-id={t.id}
              aria-current={activeId === t.id ? 'true' : undefined}
            >
              <span className="text-[10px] font-mono uppercase tracking-wider w-6 shrink-0">
                {t.n}
              </span>
              <span className="text-xs flex-1">{t.label}</span>
              <span className="text-[10px] font-mono text-muted-foreground/60">
                p. {t.pages}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
