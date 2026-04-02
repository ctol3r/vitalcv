import type { ReactNode } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface EvidenceDisclosureCardProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function EvidenceDisclosureCard({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: EvidenceDisclosureCardProps) {
  return (
    <Card className={cn('gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none', className)}>
      <CardHeader className="border-b border-white/6 px-5 py-4">
        <div className="space-y-1">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
              {eyebrow}
            </p>
          ) : null}
          <CardTitle className="text-sm font-semibold text-foreground/80">{title}</CardTitle>
          {description ? (
            <CardDescription className="text-xs leading-relaxed text-white/42">
              {description}
            </CardDescription>
          ) : null}
        </div>
        {action ? <CardAction>{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn('px-5 py-4', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
