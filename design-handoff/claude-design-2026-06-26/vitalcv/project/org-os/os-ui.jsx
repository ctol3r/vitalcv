// ════════════════════════════════════════════════════════════════════════
// os-ui.jsx — shared primitives for the Organization OS
// Reuses the VitalCV visual language: slate neutrals, status colors,
// mono labels, bordered cards. Self-contained (no dependency on app primitives).
// ════════════════════════════════════════════════════════════════════════

const cx = (...xs) => xs.filter(Boolean).join(' ');

// readiness / status tone map ------------------------------------------------
const TONE = {
  verified: { text: 'text-emerald-700', dot: 'bg-emerald-600', bar: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', ring: 'ring-emerald-600/20' },
  ready:    { text: 'text-emerald-700', dot: 'bg-emerald-600', bar: 'bg-emerald-600', soft: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', ring: 'ring-emerald-600/20' },
  pending:  { text: 'text-amber-800',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-800 ring-amber-600/20',   ring: 'ring-amber-600/20' },
  watch:    { text: 'text-amber-800',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   soft: 'bg-amber-50 text-amber-800 ring-amber-600/20',   ring: 'ring-amber-600/20' },
  gap:      { text: 'text-orange-700',  dot: 'bg-orange-500',  bar: 'bg-orange-500',  soft: 'bg-orange-50 text-orange-700 ring-orange-600/20', ring: 'ring-orange-600/20' },
  elevated: { text: 'text-orange-700',  dot: 'bg-orange-500',  bar: 'bg-orange-500',  soft: 'bg-orange-50 text-orange-700 ring-orange-600/20', ring: 'ring-orange-600/20' },
  blocked:  { text: 'text-red-700',     dot: 'bg-red-600',     bar: 'bg-red-600',     soft: 'bg-red-50 text-red-700 ring-red-600/20',       ring: 'ring-red-600/20' },
  high:     { text: 'text-red-700',     dot: 'bg-red-600',     bar: 'bg-red-600',     soft: 'bg-red-50 text-red-700 ring-red-600/20',       ring: 'ring-red-600/20' },
  access:   { text: 'text-indigo-700',  dot: 'bg-indigo-600',  bar: 'bg-indigo-600',  soft: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', ring: 'ring-indigo-600/20' },
  low:      { text: 'text-slate-600',   dot: 'bg-slate-400',   bar: 'bg-slate-300',   soft: 'bg-slate-100 text-slate-600 ring-slate-300',     ring: 'ring-slate-300' },
  slate:    { text: 'text-slate-700',   dot: 'bg-slate-500',   bar: 'bg-slate-400',   soft: 'bg-slate-100 text-slate-700 ring-slate-300',     ring: 'ring-slate-300' },
};
const tone = t => TONE[t] || TONE.slate;

const READINESS_LABEL = { ready: 'Ready', watch: 'Watch', gap: 'Action needed', blocked: 'Blocked' };

// ── Card ────────────────────────────────────────────────────────────────────
function OCard({ children, className = '', as: As = 'div', pad = true }) {
  return <As className={cx('bg-white border border-slate-200 rounded-lg', pad && 'p-5', className)}>{children}</As>;
}

// ── Pill / status chip ────────────────────────────────────────────────────────
function Pill({ t = 'slate', children, dot = true, className = '' }) {
  const m = tone(t);
  return (
    <span className={cx('inline-flex items-center gap-1.5 font-medium rounded-full ring-1 ring-inset px-2 py-0.5 text-[11px] whitespace-nowrap', m.soft, className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', m.dot, (t === 'watch' || t === 'pending') && 'pulse-soft')} />}
      {children}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────
function Avatar({ initials, size = 'md', t }) {
  const sz = size === 'lg' ? 'h-11 w-11 text-[14px]' : size === 'sm' ? 'h-7 w-7 text-[10.5px]' : 'h-9 w-9 text-[12px]';
  return (
    <div className={cx('rounded-md bg-slate-900 text-white flex items-center justify-center font-semibold flex-shrink-0', sz)}>
      {initials}
    </div>
  );
}

// ── Eyebrow / mono label ──────────────────────────────────────────────────────
function Eyebrow({ children, className = '' }) {
  return <div className={cx('mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500', className)}>{children}</div>;
}

// ── Stat / KPI tile ───────────────────────────────────────────────────────────
function Stat({ label, value, unit, sub, t = 'slate', delta, deltaLabel, big }) {
  const m = tone(t);
  return (
    <div className="bg-white p-4">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={cx('font-semibold tracking-[-0.02em] leading-none', big ? 'text-[34px]' : 'text-[26px]', t === 'slate' ? 'text-slate-900' : m.text)}>{value}</span>
        {unit && <span className="text-[12px] text-slate-400 font-medium">{unit}</span>}
        {typeof delta === 'number' && (
          <span className={cx('mono text-[11px] font-medium ml-1', delta < 0 ? 'text-emerald-700' : delta > 0 ? 'text-emerald-700' : 'text-slate-500')}>
            {delta > 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      {(sub || deltaLabel) && <div className="text-[11.5px] text-slate-500 mt-2 leading-snug">{sub || deltaLabel}</div>}
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SecHead({ eyebrow, title, sub, right, className = '' }) {
  return (
    <div className={cx('flex items-end justify-between gap-4 mb-4', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-1">{eyebrow}</Eyebrow>}
        <h2 className="text-[17px] font-semibold text-slate-900 tracking-[-0.01em] leading-tight">{title}</h2>
        {sub && <p className="text-[12.5px] text-slate-500 mt-1 max-w-[640px] leading-snug">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}

// ── Horizontal meter ──────────────────────────────────────────────────────────
function Meter({ value, max = 100, t = 'verified', className = '', h = 'h-1.5' }) {
  const m = tone(t);
  return (
    <div className={cx('w-full rounded-full bg-slate-100 overflow-hidden', h, className)}>
      <div className={cx('h-full rounded-full transition-all', m.bar)} style={{ width: Math.max(2, Math.min(100, (value / max) * 100)) + '%' }} />
    </div>
  );
}

// ── Segmented stacked bar (readiness composition) ───────────────────────────
function StackBar({ segments, h = 'h-3', rounded = true }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className={cx('w-full flex overflow-hidden bg-slate-100', rounded && 'rounded-full', h)}>
      {segments.map((s, i) => (
        <div key={i} className={cx('h-full', tone(s.t).bar)} style={{ width: (s.value / total) * 100 + '%' }} title={`${s.label}: ${s.value}`} />
      ))}
    </div>
  );
}

// ── Sparkline (SVG line) ──────────────────────────────────────────────────────
function Sparkline({ data, w = 240, h = 56, stroke = '#0f172a', fill = 'rgba(15,23,42,0.06)', dot = true }) {
  const vals = data.map(d => (typeof d === 'number' ? d : d.v));
  const min = Math.min(...vals), max = Math.max(...vals);
  const pad = 6;
  const span = max - min || 1;
  const x = i => pad + (i * (w - pad * 2)) / (vals.length - 1);
  const y = v => h - pad - ((v - min) / span) * (h - pad * 2);
  const pts = vals.map((v, i) => `${x(i)},${y(v)}`);
  const line = 'M' + pts.join(' L');
  const area = `${line} L${x(vals.length - 1)},${h} L${x(0)},${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" className="overflow-visible">
      <path d={area} fill={fill} stroke="none" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      {dot && <circle cx={x(vals.length - 1)} cy={y(vals[vals.length - 1])} r="3" fill={stroke} />}
    </svg>
  );
}

// ── Bars (vertical) ───────────────────────────────────────────────────────────
function Bars({ data, h = 100, t = 'slate', labelKey = 'm', valKey = 'v', fmt }) {
  const vals = data.map(d => d[valKey]);
  const max = Math.max(...vals);
  const m = tone(t);
  return (
    <div className="flex items-end gap-2" style={{ height: h }}>
      {data.map((d, i) => {
        const last = i === data.length - 1;
        return (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
            <div className="text-[10px] mono text-slate-400 leading-none">{fmt ? fmt(d[valKey]) : d[valKey]}</div>
            <div className={cx('w-full rounded-t-[3px] transition-all', last ? m.bar : 'bg-slate-200')} style={{ height: Math.max(4, (d[valKey] / max) * (h - 28)) }} />
            <div className="text-[9.5px] mono uppercase tracking-[0.06em] text-slate-400 leading-none">{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Radial gauge (readiness %) ─────────────────────────────────────────────────
function Gauge({ value, size = 132, stroke = 11, t = 'verified', label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const col = { verified: '#16a34a', pending: '#f59e0b', blocked: '#dc2626' }[t] || '#16a34a';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={col} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[30px] font-semibold tracking-[-0.03em] text-slate-900 leading-none tabular-nums">{value}<span className="text-[16px] text-slate-400">%</span></span>
        {label && <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500 mt-1">{label}</span>}
      </div>
    </div>
  );
}

// ── small icon button / action link ──────────────────────────────────────────
function ActLink({ children, onClick }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap">
      {children} <Icon.ArrowRight size={12} />
    </button>
  );
}

// ── Trust meter inline (number + bar) ─────────────────────────────────────────
function TrustCell({ value }) {
  const t = value >= 90 ? 'verified' : value >= 80 ? 'pending' : 'gap';
  return (
    <div className="flex items-center gap-2.5 w-[120px]">
      <span className={cx('mono text-[13px] font-medium tabular-nums w-7 text-right', tone(t).text)}>{value}</span>
      <Meter value={value} t={t} className="flex-1" />
    </div>
  );
}

Object.assign(window, {
  cx, TONE, tone, READINESS_LABEL, OCard, Pill, Avatar, Eyebrow, Stat,
  SecHead, Meter, StackBar, Sparkline, Bars, Gauge, ActLink, TrustCell,
});
