import React, { type ComponentProps, type ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

void React;

type TrustStateTone = 'default' | 'warning' | 'critical' | 'success';

const TONE_CLASS: Record<TrustStateTone, string> = {
  default: 'border-white/8 bg-white/[0.03]',
  warning: 'border-amber-500/15 bg-amber-500/[0.05]',
  critical: 'border-rose-500/15 bg-rose-500/[0.06]',
  success: 'border-emerald-500/15 bg-emerald-500/[0.05]',
};

interface TrustStateCardProps extends ComponentProps<'div'> {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  tone?: TrustStateTone;
  centered?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}

export function TrustStateCard({
  eyebrow,
  title,
  description,
  tone = 'default',
  centered = false,
  children,
  actions,
  className,
  ...props
}: TrustStateCardProps) {
  return (
    <Card
      className={cn(
        'gap-0 rounded-2xl py-0 shadow-none',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <CardHeader className={cn('px-5 py-4', centered && 'items-center text-center')}>
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/28">
            {eyebrow}
          </p>
        ) : null}
        <CardTitle className="text-sm font-semibold text-white/75">{title}</CardTitle>
        {description ? (
          <p className="text-xs leading-relaxed text-white/40">{description}</p>
        ) : null}
      </CardHeader>
      {children ? (
        <CardContent className={cn('px-5 py-0 pb-4', centered && 'text-center')}>
          {children}
        </CardContent>
      ) : null}
      {actions ? (
        <CardFooter className={cn('border-t border-white/6 px-5 py-4', centered && 'justify-center')}>
          {actions}
        </CardFooter>
      ) : null}
    </Card>
  );
}
