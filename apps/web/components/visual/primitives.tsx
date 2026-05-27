import * as React from 'react';

/* ── Eyebrow ──────────────────────────────────────────────────── */
export function Eyebrow({
  tag,
  children,
  className,
}: {
  tag?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vs-eyebrow${className ? ` ${className}` : ''}`}>
      {tag ? <span className="vs-tag">{tag}</span> : null}
      <span className="vs-ln" />
      {children ? <span>{children}</span> : null}
    </div>
  );
}

/* ── Button ───────────────────────────────────────────────────── */
type ButtonVariant = 'default' | 'primary' | 'accent' | 'ghost';
type ButtonSize = 'md' | 'lg';

type CommonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: React.ReactNode;
};

export type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>;

export function Button({ variant = 'default', size = 'md', className, children, ...rest }: ButtonProps) {
  const variantClass = variant === 'default' ? '' : ` ${variant}`;
  const sizeClass = size === 'lg' ? ' lg' : '';
  return (
    <button
      {...rest}
      className={`vs-btn${variantClass}${sizeClass}${className ? ` ${className}` : ''}`}
    >
      {children}
    </button>
  );
}

export type LinkButtonProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'className' | 'children'>;

export function LinkButton({ variant = 'default', size = 'md', className, children, ...rest }: LinkButtonProps) {
  const variantClass = variant === 'default' ? '' : ` ${variant}`;
  const sizeClass = size === 'lg' ? ' lg' : '';
  return (
    <a
      {...rest}
      className={`vs-btn${variantClass}${sizeClass}${className ? ` ${className}` : ''}`}
    >
      {children}
    </a>
  );
}

/* ── Input ────────────────────────────────────────────────────── */
// `size` collides with the native HTML <input size="N"> attribute,
// so we omit it from the base type before redeclaring it as 'md' | 'lg'.
export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className' | 'size'> & {
  mono?: boolean;
  size?: 'md' | 'lg';
  className?: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { mono, size = 'md', className, ...rest },
  ref,
) {
  const monoClass = mono ? ' mono' : '';
  const sizeClass = size === 'lg' ? ' lg' : '';
  return (
    <input
      ref={ref}
      {...rest}
      className={`vs-input${monoClass}${sizeClass}${className ? ` ${className}` : ''}`}
    />
  );
});

/* ── Field Group (label + input + hint) ───────────────────────── */
export function FieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`vs-field-grp${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function FieldHint({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`vs-hint${className ? ` ${className}` : ''}`}>{children}</div>;
}

/* ── Card ─────────────────────────────────────────────────────── */
export function Card({
  warm,
  children,
  className,
  style,
  id,
}: {
  warm?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}) {
  return (
    <div
      className={`vs-card${warm ? ' warm' : ''}${className ? ` ${className}` : ''}`}
      style={style}
      id={id}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  aside,
  className,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vs-card-hd${className ? ` ${className}` : ''}`}>
      <span className="vs-ttl">{title}</span>
      <span className="vs-sp" />
      {aside ? <span className="vs-aside">{aside}</span> : null}
    </div>
  );
}

export function CardBody({
  tight,
  children,
  className,
  style,
}: {
  tight?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`vs-card-bd${tight ? ' tight' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`vs-card-ft${className ? ` ${className}` : ''}`}>{children}</div>;
}

/* ── Field Row (label · value · meta-chip) ────────────────────── */
export function FieldRow({
  label,
  value,
  source,
  meta,
  mono,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  source?: React.ReactNode;
  meta?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="vs-field">
      <span className="vs-label">{label}</span>
      <span className={`vs-value${mono ? ' mono-val' : ''}`}>
        {value}
        {source ? <small className="vs-source">{source}</small> : null}
      </span>
      {meta ? <span className="vs-meta">{meta}</span> : null}
    </div>
  );
}

/* ── Boundary Banner ──────────────────────────────────────────── */
export function BoundaryBanner({
  label,
  message,
  action,
  className,
  style,
}: {
  label: React.ReactNode;
  message: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`vs-boundary-banner${className ? ` ${className}` : ''}`} style={style}>
      <span className="vs-ic">i</span>
      <div>
        <span className="vs-k">{label}</span>
        <span className="vs-v">{message}</span>
      </div>
      {action ?? <span />}
    </div>
  );
}

/* ── Degraded Source Banner (chat22 fix #7) ───────────────────── */
export function DegradedBanner({
  source,
  age,
  affected,
  className,
}: {
  source: string;
  age: string;
  affected?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vs-degraded-banner${className ? ` ${className}` : ''}`} role="status">
      <span className="vs-ic" aria-hidden>!</span>
      <div>
        <strong>{source} offline</strong> · {age}
        {affected ? (
          <>
            {' '}
            · <span className="vs-meta">{affected}</span>
          </>
        ) : null}
      </div>
      <span className="vs-meta">system condition</span>
    </div>
  );
}

/* ── Command Pill ─────────────────────────────────────────────── */
export function CmdPill({
  shortcut = '⌘K',
  label = 'Find clinician, NPI, source',
  onClick,
  className,
}: {
  shortcut?: string;
  label?: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`vs-cmd-pill${className ? ` ${className}` : ''}`}
      onClick={onClick}
    >
      <span className="vs-kbd">{shortcut}</span>
      <span>{label}</span>
    </button>
  );
}

/* ── Segment (segmented control) ──────────────────────────────── */
export function Segment({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`vs-segment${className ? ` ${className}` : ''}`} role="tablist">
      {children}
    </div>
  );
}

/* ── Section Scaffold ─────────────────────────────────────────── */
export function Section({
  num,
  title,
  aside,
  children,
  className,
}: {
  num: string;
  title: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`vs-section${className ? ` ${className}` : ''}`}>
      <div className="vs-sec-head">
        <span className="vs-sec-num">{num}</span>
        <h2 className="vs-sec-title">{title}</h2>
        {aside ? <span className="vs-sec-aside">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}
