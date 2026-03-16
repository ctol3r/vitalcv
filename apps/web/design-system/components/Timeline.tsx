import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export interface TimelineItem {
  id: string;
  title: string;
  detail?: string | null;
  time?: string | null;
  tone?: 'neutral' | 'accent' | 'warning' | 'critical' | 'success';
}

export function Timeline({
  className,
  items,
}: {
  items: TimelineItem[];
  className?: string;
}) {
  return (
    <ol className={cn('space-y-[var(--vt-space-16)]', className)}>
      {items.map((item) => (
        <li key={item.id} className="relative pl-[var(--vt-space-24)]">
          <span
            aria-hidden="true"
            className="absolute left-0 top-[0.35rem] h-2.5 w-2.5 rounded-full bg-[var(--vt-accent)]"
          />
          <div className="space-y-[var(--vt-space-8)] rounded-[var(--vt-radius-md)] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-[var(--vt-space-16)]">
            <div className="flex flex-wrap items-center gap-[var(--vt-space-8)]">
              {item.tone ? <Badge variant={item.tone}>{item.tone}</Badge> : null}
              {item.time ? (
                <span className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]">
                  {item.time}
                </span>
              ) : null}
            </div>
            <h3 className="text-[length:var(--vt-type-meta-size)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
              {item.title}
            </h3>
            {item.detail ? (
              <p className="text-[length:var(--vt-type-meta-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
                {item.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
