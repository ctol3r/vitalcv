'use client';
import React from 'react';
const COLORS = { info: 'bg-blue-600', warning: 'bg-amber-500', critical: 'bg-red-600' };
interface Props { message: string; type?: 'info' | 'warning' | 'critical'; dismissible?: boolean; ctaText?: string; ctaHref?: string }
export function AnnouncementBar({ message, type = 'info', dismissible = true, ctaText, ctaHref }: Props) {
  const [dismissed, setDismissed] = React.useState(false);
  React.useEffect(() => { if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('bar-dismissed-' + message)) setDismissed(true); }, [message]);
  if (dismissed) return null;
  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] ${COLORS[type]} text-white text-xs py-2 px-4 flex items-center justify-between`}>
      <span>{message}{ctaText && ctaHref && <a href={ctaHref} className="ml-3 underline font-semibold">{ctaText}</a>}</span>
      {dismissible && <button onClick={() => { setDismissed(true); sessionStorage.setItem('bar-dismissed-' + message, '1'); }} className="ml-4 opacity-70 hover:opacity-100">✕</button>}
    </div>
  );
}
