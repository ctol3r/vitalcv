'use client';

/**
 * FloatingCredentials — Wave 230 / Antigravity UI
 *
 * Credential badges drifting in zero gravity — the visual signature
 * of VitalCV as antigravity trust infrastructure.
 *
 * Pure CSS keyframe animations, no JS runtime cost.
 */

import { CheckCircle2, Shield, Zap } from 'lucide-react';

interface CredentialChip {
  label: string;
  sublabel: string;
  icon: 'shield' | 'check' | 'zap';
  color: 'green' | 'blue' | 'amber' | 'purple';
  style: React.CSSProperties;
  animClass: string;
}

const CHIPS: CredentialChip[] = [
  {
    label: 'Medical License',
    sublabel: 'California · Active',
    icon: 'check',
    color: 'green',
    style: { top: '14%', left: '5%' },
    animClass: 'animate-drift-1',
  },
  {
    label: 'Board certification',
    sublabel: 'Source required',
    icon: 'shield',
    color: 'blue',
    style: { top: '18%', right: '7%' },
    animClass: 'animate-drift-2',
  },
  // M1: DEA and NPDB are not integrated. Replaced with live-source credentials.
  {
    label: 'OIG/LEIE Clear',
    sublabel: 'Not excluded',
    icon: 'check',
    color: 'green',
    style: { bottom: '30%', left: '4%' },
    animClass: 'animate-drift-3',
  },
  {
    label: 'Nursys access required',
    sublabel: 'Institutional lane gated',
    icon: 'shield',
    color: 'amber',
    style: { bottom: '20%', right: '5%' },
    animClass: 'animate-drift-4',
  },
  {
    label: 'Hospital Privileges',
    sublabel: 'Stanford Health · Active',
    icon: 'check',
    color: 'purple',
    style: { top: '50%', left: '2%' },
    animClass: 'animate-drift-5',
  },
  {
    label: 'OIG Excluded',
    sublabel: 'Not Listed ✓',
    icon: 'zap',
    color: 'green',
    style: { top: '52%', right: '3%' },
    animClass: 'animate-drift-6',
  },
];

const COLOR_MAP = {
  green:  { border: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'text-emerald-400' },
  blue:   { border: 'border-blue-500/30',    bg: 'bg-blue-500/10',    text: 'text-blue-400',    icon: 'text-blue-400' },
  amber:  { border: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-400',   icon: 'text-amber-400' },
  purple: { border: 'border-purple-500/30',  bg: 'bg-purple-500/10',  text: 'text-purple-400',  icon: 'text-purple-400' },
};

function ChipIcon({ kind, className }: { kind: CredentialChip['icon']; className: string }) {
  if (kind === 'shield') return <Shield className={`h-3 w-3 ${className}`} />;
  if (kind === 'zap')    return <Zap    className={`h-3 w-3 ${className}`} />;
  return <CheckCircle2 className={`h-3 w-3 ${className}`} />;
}

export function FloatingCredentials() {
  return (
    <>
      {/* Keyframe definitions injected inline for isolation */}
      <style>{`
        @keyframes drift1 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(-1deg); }
          33%     { transform: translateY(-18px) translateX(6px) rotate(0.5deg); }
          66%     { transform: translateY(-8px) translateX(-4px) rotate(-2deg); }
        }
        @keyframes drift2 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(1deg); }
          40%     { transform: translateY(-22px) translateX(-8px) rotate(-0.5deg); }
          70%     { transform: translateY(-10px) translateX(5px) rotate(1.5deg); }
        }
        @keyframes drift3 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(0.5deg); }
          50%     { transform: translateY(-16px) translateX(10px) rotate(-1.5deg); }
        }
        @keyframes drift4 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(-0.5deg); }
          45%     { transform: translateY(-20px) translateX(-6px) rotate(1deg); }
          80%     { transform: translateY(-6px) translateX(4px) rotate(-1deg); }
        }
        @keyframes drift5 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(1.5deg); }
          35%     { transform: translateY(-14px) translateX(8px) rotate(-0.5deg); }
          65%     { transform: translateY(-24px) translateX(-3px) rotate(1deg); }
        }
        @keyframes drift6 {
          0%,100% { transform: translateY(0px) translateX(0px) rotate(-1deg); }
          55%     { transform: translateY(-12px) translateX(-9px) rotate(0.8deg); }
        }
        .animate-drift-1 { animation: drift1 7.2s ease-in-out infinite; }
        .animate-drift-2 { animation: drift2 8.6s ease-in-out infinite 0.8s; }
        .animate-drift-3 { animation: drift3 6.8s ease-in-out infinite 1.4s; }
        .animate-drift-4 { animation: drift4 9.1s ease-in-out infinite 0.3s; }
        .animate-drift-5 { animation: drift5 7.7s ease-in-out infinite 1.8s; }
        .animate-drift-6 { animation: drift6 8.2s ease-in-out infinite 0.6s; }
      `}</style>

      {CHIPS.map((chip) => {
        const c = COLOR_MAP[chip.color];
        return (
          <div
            key={chip.label}
            className={`absolute pointer-events-none hidden lg:flex items-center gap-2 rounded-xl border ${c.border} ${c.bg} backdrop-blur-sm px-3 py-2 shadow-lg ${chip.animClass}`}
            style={chip.style}
          >
            <ChipIcon kind={chip.icon} className={c.icon} />
            <div>
              <p className={`text-[11px] font-semibold ${c.text} leading-none`}>{chip.label}</p>
              <p className="text-[10px] text-muted-foreground leading-none mt-0.5">{chip.sublabel}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}
