import type { LucideIcon, LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IconProps extends LucideProps {
  icon: LucideIcon;
}

export function Icon({ className, icon: Glyph, ...props }: IconProps) {
  return <Glyph className={cn('h-4 w-4', className)} aria-hidden="true" {...props} />;
}
