import React, { type ComponentProps, type ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
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
  /**
   * Element for the title. Defaults to CardTitle's own `div`, because this card
   * is usually one panel among many and promoting every instance would scramble
   * heading order site-wide.
   *
   * Pass `'h1'` when the card IS the page — the terminal state of a route, where
   * nothing else supplies a document heading. EC-5 requires exactly one, and the
   * 2026-08-09 audit found /review/[entityId] rendering none precisely because
   * its unresolved-link state is a bare TrustStateCard.
   */
  titleAs?: 'div' | 'h1' | 'h2';
  description?: ReactNode;
  tone?: TrustStateTone;
  centered?: boolean;
  children?: ReactNode;
  actions?: ReactNode;
}

export function TrustStateCard({
  eyebrow,
  title,
  titleAs = 'div',
  description,
  tone = 'default',
  centered = false,
  children,
  actions,
  className,
  ...props
}: TrustStateCardProps) {
  const TitleTag = titleAs;
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/40">
            {eyebrow}
          </p>
        ) : null}
        {/* One render path for every value of titleAs. The classes and
            data-slot below reproduce CardTitle's own output exactly (it is a
            div with `leading-none font-semibold`), so `titleAs="div"` — the
            default — is byte-identical to what shipped before; `m-0` only
            matters once the tag is a heading with UA margins. */}
        <TitleTag
          data-slot="card-title"
          className="m-0 text-sm leading-none font-semibold text-foreground/70"
        >
          {title}
        </TitleTag>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
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
