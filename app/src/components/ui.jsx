import React, { useEffect } from 'react';

const ICONS = {
  compare: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  docs: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5M9 13h6M9 17h6',
  adopt: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  score: 'M12 3v18M5 8h14M7 13h10M9 18h6',
  talk: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  stress: 'M12 3 2 20h20L12 3Zm0 6v5m0 3.5v.5',
  market: 'M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6',
  personas: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm13 9v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.2-1.3L14.4 3h-4l-.4 2.4a7.4 7.4 0 0 0-2.2 1.3l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.6l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.2 1.3l.4 2.4h4l.4-2.4a7.4 7.4 0 0 0 2.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3Z',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4',
  play: 'M7 4v16l13-8L7 4Z',
  close: 'M6 6l12 12M18 6 6 18',
  download: 'M12 4v11m0 0-4-4m4 4 4-4M4 20h16',
  upload: 'M12 16V5m0 0-4 4m4-4 4 4M4 20h16',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z',
  send: 'M4 12 20 4l-6 16-3-7-7-1Z',
  channel: 'M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0M12 12v8M9 20h6',
  rival: 'M5 4h5v5H5zM14 15h5v5h-5zM10 6.5h3a2 2 0 0 1 2 2V15M14 17.5h-3a2 2 0 0 1-2-2V9',
  github: 'M9 19c-4 1.3-4-2-6-2.5m12 5v-3.5a3 3 0 0 0-.9-2.4c3-.3 6-1.5 6-6.6a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6s-1.1-.3-3.6 1.4a12.4 12.4 0 0 0-6.5 0C6 .8 4.9 1.1 4.9 1.1a4.8 4.8 0 0 0-.1 3.6 5.2 5.2 0 0 0-1.4 3.6c0 5.1 3 6.3 6 6.6a3 3 0 0 0-.9 2.4V22',
};

export function Icon({ name, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={ICONS[name]} />
    </svg>
  );
}

const VARS = ['a', 'b', 'c', 'd'];
export const variantVars = (i) => ({ '--vc': `var(--${VARS[i % 4]})`, '--vsoft': `var(--${VARS[i % 4]}-soft)` });
export const variantColor = (i) => `var(--${VARS[i % 4]})`;

export const initials = (name) => name.split(' ').map((w) => w[0]).slice(0, 2).join('');

export function Avatar({ name, size }) {
  return <span className={`avatar ${size ?? ''}`} aria-hidden="true">{initials(name)}</span>;
}

export function PainChip({ level }) {
  return <span className={`chip ${level}`}>{level} pain</span>;
}

export function Dialog({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog-head">
          <h2>{title}</h2>
          <button className="btn ghost small" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="dialog-body">{children}</div>
        {footer && <div className="dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export const pct = (x) => `${Math.round(x * 100)}%`;
export const r0 = (x) => Math.round(x);

/** Background tint for a 0-100 score: cool and pale when low, deep ink-blue when high. */
export function scoreTint(score) {
  const t = Math.max(0, Math.min(1, (score - 15) / 75));
  // interpolate between pale slate and deep blue, in oklch-ish steps via rgb
  const lo = [236, 239, 243];
  const hi = [31, 74, 168];
  const c = lo.map((l, i) => Math.round(l + (hi[i] - l) * t));
  return { background: `rgb(${c.join(',')})`, color: t > 0.52 ? '#fff' : 'var(--ink)' };
}
