import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  FileInput,
  FileSearch,
  FileCheck2,
  FileKey2,
  Files,
  ListChecks,
  Loader2,
  MessageCircleQuestion,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';

const ICONS = {
  'arrow-down': ArrowDown,
  'arrow-left': ArrowLeft,
  'arrow-right': ArrowRight,
  building: Building2,
  clock: Clock3,
  'file-input': FileInput,
  'file-search': FileSearch,
  'file-check': FileCheck2,
  'file-key': FileKey2,
  files: Files,
  'list-checks': ListChecks,
  loader: Loader2,
  'message-question': MessageCircleQuestion,
  scale: Scale,
  search: Search,
  send: Send,
  alert: ShieldAlert,
  shield: ShieldCheck,
  waypoints: Waypoints,
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
