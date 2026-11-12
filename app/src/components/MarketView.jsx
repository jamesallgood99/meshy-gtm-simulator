import React, { useMemo, useState } from 'react';
import { Avatar, PainChip, cap } from './ui.jsx';
import { PAIN_ORDER } from '../lib/stats.js';

function countBy(xs, f) {
  const m = new Map();
  for (const x of xs) m.set(f(x), (m.get(f(x)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const LEVEL_COLOR = { High: 'var(--hi)', Medium: 'var(--mid)', Low: 'var(--lo)' };

export function MarketView({ market }) {
  const { companies, personas, roles } = market;
  const segOrder = market.segments?.map((s) => s.label);
  const industries = countBy(companies, (c) => c.industry)
    .sort((a, b) => (segOrder ? segOrder.indexOf(a[0]) - segOrder.indexOf(b[0]) : 0));
  const types = countBy(companies, (c) => c.company_type ?? c.industry);
  const committee = Object.fromEntries(countBy(personas, (p) => p.industry));
  const perCompany = countBy(companies, (c) => personas.filter((p) => p.company_id === c.id).length).map(([k]) => Number(k)).sort((a, b) => a - b);
  const lo = (b) => Number(String(b).split('-')[0].replace(/,/g, '')) || 0;
  const sizes = countBy(companies, (c) => c.size_band).sort((a, b) => lo(a[0]) - lo(b[0]));
  const maxInd = industries[0][1];

  const rolePains = roles.map((r) => {
    const ps = personas.filter((p) => p.role === r.key);
    const agg = new Map();
    for (const p of ps) {
      for (const x of p.pains) {
        const k = x.source === 'industry' ? '__industry' : x.label;
        const e = agg.get(k) ?? { label: x.source === 'industry' ? 'Company-type pain (varies)' : x.label, n: 0, sum: 0, industry: x.source === 'industry' };
        e.n++; e.sum += x.intensity;
        agg.set(k, e);
      }
    }
    const levels = Object.fromEntries(PAIN_ORDER.map((l) => [l, ps.filter((p) => p.pain_level === l).length]));
    return { role: r, n: ps.length, pains: [...agg.values()].sort((a, b) => b.n - a.n || b.sum - a.sum), levels };
  });

  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{companies.length}</b><span>Fictional companies</span></div>
        <div className="kpi"><b>{personas.length}</b><span>Personas, {perCompany[0]} to {perCompany.at(-1)} per company by segment</span></div>
        <div className="kpi"><b>{industries.length}</b><span>Segments, weighted equally</span></div>
        <div className="kpi"><b>{(personas.reduce((s, p) => s + p.pains.length, 0) / personas.length).toFixed(1)}</b><span>Pain points per persona</span></div>
      </div>

      <section className="section two-col">
        <div className="panel">
          <div className="section-head"><h2>Segment mix</h2><p>Companies, and personas in their buying committees</p></div>
          {industries.map(([k, n]) => (
            <div className="hbar" key={k}>
              <span>{k}</span>
              <div className="track"><div className="fill" style={{ width: `${(n / maxInd) * 100}%` }} /></div>
              <span className="n">{n} / {committee[k]}</span>
            </div>
          ))}
          <div className="section-head" style={{ marginTop: 18 }}><h2>Company types</h2><p>Companies</p></div>
          {types.map(([k, n]) => (
            <div className="hbar" key={k}>
              <span>{k}</span>
              <div className="track"><div className="fill" style={{ width: `${(n / types[0][1]) * 100}%` }} /></div>
              <span className="n">{n}</span>
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="section-head"><h2>Company size</h2><p>Employees</p></div>
          {sizes.map(([k, n]) => (
            <div className="hbar" key={k}>
              <span>{k}</span>
              <div className="track"><div className="fill" style={{ width: `${(n / companies.length) * 100}%` }} /></div>
              <span className="n">{n}</span>
            </div>
          ))}
          <div className="section-head" style={{ marginTop: 18 }}><h2>Pain level by role</h2><p>Relative to each segment</p></div>
          {rolePains.map(({ role, n, levels }) => (
            <div className="hbar" key={role.key}>
              <span>{role.label}</span>
              <div className="stack" role="img" aria-label={PAIN_ORDER.map((l) => `${levels[l]} ${l}`).join(', ')}>
                {PAIN_ORDER.map((l) => <span key={l} style={{ width: `${(levels[l] / n) * 100}%`, background: LEVEL_COLOR[l] }} />)}
              </div>
              <span className="n">{n}</span>
            </div>
          ))}
          <p className="note" style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--hi)' }}>■</span> High <span style={{ color: 'var(--mid)', marginLeft: 8 }}>■</span> Medium <span style={{ color: 'var(--lo)', marginLeft: 8 }}>■</span> Low
          </p>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What each role is carrying</h2>
          <p>How many personas in the role carry each pain, and how hard it bites on average</p>
        </div>
        <div className="role-pains">
          {rolePains.map(({ role, n, pains }) => (
            <div className="panel" key={role.key}>
              <h3>{role.label}</h3>
              <p className="sub">{role.buying_role}</p>
              {pains.map((x) => (
                <div className="pain-line" key={x.label}>
                  <span style={x.industry ? { fontStyle: 'italic' } : undefined}>{x.label}</span>
                  <span className="n">{x.n === n ? 'all' : x.n}</span>
                  <div className="track"><div className="fill" style={{ width: `${(x.sum / x.n) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {market.competitors?.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Competitors loaded</h2>
            <p>Their positioning, in their own words. Their feature messages are preloaded on the Competition page.</p>
          </div>
          <div className="role-pains">
            {market.competitors.map((c) => (
              <div className="panel" key={c.name}>
                <h3>{c.name}</h3>
                <p className="sub">{c.positioning}</p>
                <p className="note">Current tool for {personas.filter((p) => p.current_tool?.includes(c.name.replace(/ AI$/, '').split(' ').at(-1))).length} personas in this market.</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function PersonasView({ market, onTalk }) {
  const [role, setRole] = useState('all');
  const [level, setLevel] = useState('all');
  const [industry, setIndustry] = useState('all');
  const [q, setQ] = useState('');
  const industries = useMemo(() => market.segments?.map((s) => s.label) ?? [...new Set(market.personas.map((p) => p.industry))].sort(), [market]);
  const rows = market.personas.filter((p) =>
    (role === 'all' || p.role === role) &&
    (level === 'all' || p.pain_level === level) &&
    (industry === 'all' || p.industry === industry) &&
    (!q.trim() || `${p.name} ${p.title} ${p.company} ${p.pains.map((x) => x.label).join(' ')}`.toLowerCase().includes(q.toLowerCase())));
  const [limit, setLimit] = useState(60);

  return (
    <>
      <div className="filters">
        <input type="search" placeholder="Search names, companies, pains" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search personas" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="all">All roles</option>
          {market.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Pain level">
          <option value="all">All pain levels</option>
          {PAIN_ORDER.map((l) => <option key={l} value={l}>{l} pain</option>)}
        </select>
        <select value={industry} onChange={(e) => setIndustry(e.target.value)} aria-label="Segment">
          <option value="all">All segments</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <span className="note" style={{ alignSelf: 'center' }}>{rows.length} personas</span>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr><th>Persona</th><th>Company</th><th>Pain</th><th>Pain points</th><th>Skepticism</th><th>Right now</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((p) => (
              <tr key={p.id} className="clickable" onClick={() => onTalk(p.id)} title={`Talk to ${p.name}`}>
                <td>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar name={p.name} />
                    <div><b>{p.name}</b><div className="note">{p.title}</div></div>
                  </div>
                </td>
                <td>{p.company}<div className="note">{p.company_type ?? p.industry}, {p.size_band}</div></td>
                <td><PainChip level={p.pain_level} /></td>
                <td className="pain-cell">{p.pains.map((x) => `${x.label} (${x.intensity.toFixed(2)})`).join(' / ')}</td>
                <td>{p.skepticism.toFixed(2)}</td>
                <td className="note">{cap(p.trigger)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn" onClick={() => setLimit((l) => l + 100)}>Show more ({rows.length - limit} left)</button>
        </div>
      )}
    </>
  );
}
