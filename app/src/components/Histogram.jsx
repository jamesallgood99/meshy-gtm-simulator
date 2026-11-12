import React from 'react';

/** Distribution of persona interest scores from the Monte Carlo run, drawn as SVG. */
export default function Histogram({ mc, color, height = 190, width = 360 }) {
  const W = width;
  const H = height;
  const pad = { l: 34, r: 8, t: 22, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(...mc.hist, 1);
  const niceMax = Math.ceil(max / 5) * 5 || 5;
  const bw = iw / mc.hist.length;
  const x = (score) => pad.l + (score / 100) * iw;
  const y = (v) => pad.t + ih - (v / niceMax) * ih;
  const yTicks = [0, niceMax / 2, niceMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Distribution of interest scores, mean ${Math.round(mc.mean)}`}>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line-2)" />
          <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--ink-3)">{Math.round(t)}</text>
        </g>
      ))}
      <rect x={x(70)} y={pad.t} width={x(100) - x(70)} height={ih} fill={color} opacity="0.06" />
      {mc.hist.map((v, i) => (
        <rect key={i} x={pad.l + i * bw + 1} y={y(v)} width={Math.max(0, bw - 2)} height={pad.t + ih - y(v)} rx="1.5" fill={color} opacity={i * mc.binWidth >= 70 ? 0.95 : 0.6} />
      ))}
      <line x1={x(mc.mean)} x2={x(mc.mean)} y1={pad.t - 6} y2={pad.t + ih} stroke="var(--ink)" strokeDasharray="3 3" />
      <text x={x(mc.mean)} y={pad.t - 9} textAnchor="middle" fontSize="11" fontWeight="650" fill="var(--ink)">{Math.round(mc.mean)}</text>
      {[0, 20, 40, 60, 80, 100].map((t) => (
        <text key={t} x={x(t)} y={H - 14} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{t}</text>
      ))}
      <text x={pad.l + iw / 2} y={H - 1} textAnchor="middle" fontSize="10" fill="var(--ink-3)">Interest score (shaded: above 70)</text>
      <text x={10} y={pad.t + ih / 2} textAnchor="middle" fontSize="10" fill="var(--ink-3)" transform={`rotate(-90 10 ${pad.t + ih / 2})`}>Personas</text>
    </svg>
  );
}
