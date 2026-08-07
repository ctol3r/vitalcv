import {
  ArrowRight,
  Building2,
  Clock3,
  FileCheck2,
  FileKey2,
  Loader2,
  Send,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

const ICONS = {
  'arrow-right': ArrowRight,
  building: Building2,
  clock: Clock3,
  'file-check': FileCheck2,
  'file-key': FileKey2,
  loader: Loader2,
  send: Send,
  alert: ShieldAlert,
  shield: ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface IconProps extends Omit<ComponentPropsWithoutRef<'svg'>, 'name'> {
  name: IconName;
}

/**
 * Closed glyph boundary required by DG-18.4. Truth-state semantics still belong
 * exclusively to TrustGlyph; this wrapper is for navigation and document/action
 * affordances only.
 */
export function Icon({ name, ...props }: IconProps) {
  const Glyph = ICONS[name];
  return <Glyph {...props} />;
}
