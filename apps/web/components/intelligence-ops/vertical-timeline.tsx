import { cn } from '@/lib/utils';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';

export interface VerticalTimelineItem {
  id: string;
  occurredAt: string | null | undefined;
  description: string;
  label?: string;
  meta?: string;
}

export function VerticalTimeline({
  items,
  emptyMessage = 'No events recorded yet.',
  className,
}: {
  items: VerticalTimelineItem[];
  emptyMessage?: string;
  className?: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyMessage}</p>;
  }

  const sortedItems = [...items].sort((left, right) => {
    const leftTime = Date.parse(left.occurredAt ?? '');
    const rightTime = Date.parse(right.occurredAt ?? '');
    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
      return 0;
    }
    if (Number.isNaN(leftTime)) {
      return 1;
    }
    if (Number.isNaN(rightTime)) {
      return -1;
    }
    return leftTime - rightTime;
  });

  return (
    <ol className={cn('space-y-4', className)}>
      {sortedItems.map((item) => (
        <li key={item.id} className="relative ml-2 border-l border-white/10 pl-6 pb-4 last:pb-0">
          <span className="absolute -left-[0.4375rem] top-1.5 h-3.5 w-3.5 rounded-full border border-cyan-300/40 bg-cyan-300 ring-4 ring-slate-950" />
          <div className="space-y-1">
            {item.label ? (
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/80">{item.label}</p>
            ) : null}
            {item.occurredAt ? (
              <p className="text-xs text-slate-400" title={formatAbsoluteTime(item.occurredAt)}>
                {formatRelativeTime(item.occurredAt)}
              </p>
            ) : null}
            <p className="text-sm leading-6 text-slate-300">{item.description}</p>
            {item.meta ? <p className="text-xs text-slate-500">{item.meta}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
