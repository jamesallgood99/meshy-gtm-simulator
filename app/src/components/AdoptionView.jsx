import React, { useMemo, useState } from 'react';
import { Avatar, PainChip, scoreTint, Icon } from './ui.jsx';
import { mean, VETO, PLURALS } from '../lib/stats.js';

function aggregate(rows, personasById, features, roles) {
  const cell = {};
  for (const f of features) {
    cell[f.id] = { all: [] };
    for (const r of roles) cell[f.id][r.key] = [];
  }
  for (const row of rows) {
    const p = personasById[row.persona_id];
    if (!p || !cell[row.feature_id]) continue;
    cell[row.feature_id][p.role]?.push(row);
    cell[row.feature_id].all.push(row);
  }
  const stat = (rs) => rs.length
    ? { n: rs.length, enth: mean(rs.map((x) => x.enthusiasm)), a90: mean(rs.map((x) => x.adopt_90d)), a12: mean(rs.map((x) => x.adopt_12m)), rows: rs }
    : null;
  const out = {};
  for (const f of features) {
    out[f.id] = {};
    for (const k of Object.keys(cell[f.id])) out[f.id][k] = stat(cell[f.id][k]);
  }
  return out;
}

function findings(agg, features, roles, roleLabel) {
  const cells = [];
  for (const f of features) for (const r of roles) if (agg[f.id][r.key]) cells.push({ f, r, ...agg[f.id][r.key] });
  if (!cells.length) return [];
  const plural = (k) => PLURALS[roleLabel[k]] ?? `${roleLabel[k]}s`;
  const out = [];

  const pull = [...cells].sort((a, b) => b.enth - a.enth)[0];
  out.push({ kind: 'pull', text: `${pull.f.name} has the strongest pull: ${plural(pull.r.key)} rate it ${Math.round(pull.enth)} out of 100.` });

  const split = features.map((f) => {
    const prim = roles.filter((r) => f.primary_roles.includes(r.key) && agg[f.id][r.key]);
    const veto = roles.filter((r) => VETO.has(r.key) && !f.primary_roles.includes(r.key) && agg[f.id][r.key]);
    if (!prim.length || !veto.length) return null;
    const hi = prim.sort((a, b) => agg[f.id][b.key].enth - agg[f.id][a.key].enth)[0];
    const lo = veto.sort((a, b) => agg[f.id][a.key].enth - agg[f.id][b.key].enth)[0];
    return { f, hi, lo, gap: agg[f.id][hi.key].enth - agg[f.id][lo.key].enth };
  }).filter(Boolean).sort((a, b) => b.gap - a.gap)[0];
  if (split && split.gap >= 30) {
    out.push({ kind: 'split', text: `${split.f.name} splits the buying group: ${plural(split.hi.key)} ${Math.round(agg[split.f.id][split.hi.key].enth)}, ${plural(split.lo.key)} ${Math.round(agg[split.f.id][split.lo.key].enth)}. ${roleLabel[split.lo.key]} can block it.` });
  }

  const fade = [...cells].filter((c) => c.a90 >= 15).sort((a, b) => (b.a90 - b.a12) - (a.a90 - a.a12))[0];
  if (fade && fade.a90 - fade.a12 >= 8) {
    out.push({ kind: 'fade', text: `${fade.f.name} fades with ${plural(fade.r.key)}: ${Math.round(fade.a90)}% using it at 90 days, ${Math.round(fade.a12)}% at 12 months.` });
  }
  const grow = [...cells].sort((a, b) => (b.a12 - b.a90) - (a.a12 - a.a90))[0];
  if (grow && grow.a12 - grow.a90 >= 8) {
    out.push({ kind: 'grow', text: `${grow.f.name} grows with ${plural(grow.r.key)}: ${Math.round(grow.a90)}% at 90 days, ${Math.round(grow.a12)}% at 12 months.` });
  }
  const orphan = features.find((f) => roles.every((r) => !agg[f.id][r.key] || agg[f.id][r.key].enth < 55));
  if (orphan) out.push({ kind: 'orphan', text: `No role is enthusiastic about ${orphan.name}. Check who it's for before it takes launch time.` });
  return out;
}

/** Collapse identical notes so the list shows distinct points of view, strongest first. */
function groupNotes(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = r.note.trim().toLowerCase();
    if (!groups.has(k)) groups.set(k, { r, others: 0 });
    else groups.get(k).others++;
  }
  return [...groups.values()];
}

function Dumbbell({ features, agg, roleKey }) {
  const rows = features
    .map((f) => ({ f, s: agg[f.id][roleKey] }))
    .filter((x) => x.s)
    .sort((a, b) => b.s.a12 - a.s.a12);
  return (
    <div className="dumbbell">
      {rows.map(({ f, s }) => {
        const lo = Math.min(s.a90, s.a12);
        const hi = Math.max(s.a90, s.a12);
        const delta = s.a12 - s.a90;
        const dir = delta >= 5 ? 'grow' : delta <= -5 ? 'fade' : 'flat';
        return (
          <div className="db-row" key={f.id}>
            <div className="db-label">{f.name}</div>
            <div className="db-track" role="img" aria-label={`${f.name}: ${Math.round(s.a90)}% at 90 days, ${Math.round(s.a12)}% at 12 months`}>
              <div className="db-grid" />
              <div className={`db-bar ${dir}`} style={{ left: `${lo}%`, width: `${hi - lo}%` }} />
              <span className="db-dot d90" style={{ left: `${s.a90}%` }} />
              <span className={`db-dot d12 ${dir}`} style={{ left: `${s.a12}%` }} />
            </div>
            <div className={`db-val ${dir}`}>{Math.round(s.a90)}% <span aria-hidden="true">→</span> {Math.round(s.a12)}%</div>
          </div>
        );
      })}
      <div className="db-row db-axis">
        <div />
        <div className="ticks"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
        <div />
      </div>
    </div>
  );
}

export default function AdoptionView({ market, brief, adoption, live, busy, onRun, onGo, onTalk }) {
  const features = brief?.features ?? [];
  const roles = market.roles;
  const roleLabel = Object.fromEntries(roles.map((r) => [r.key, r.label]));
  const personasById = useMemo(() => Object.fromEntries(market.personas.map((p) => [p.id, p])), [market]);
  const rows = adoption?.rows ?? [];
  const agg = useMemo(() => aggregate(rows, personasById, features, roles), [rows, personasById, features, roles]);
  const notes = useMemo(() => findings(agg, features, roles, roleLabel), [agg, features, roles]);

  const [timeRole, setTimeRole] = useState('all');
  const [sel, setSel] = useState(null);
  const selRole = sel?.role ?? (roles.find((r) => features[0]?.primary_roles.includes(r.key)) ?? roles[0]).key;
  const selFeat = sel?.fid ?? features[0]?.id;

  if (!features.length) {
    return (
      <div className="panel empty">
        <p>Adoption needs a feature list. Upload a PRD on the Documents page and Claude will pull the features out.</p>
        <p style={{ marginTop: 12 }}><button className="btn primary" onClick={() => onGo('documents')}>Go to documents</button></p>
      </div>
    );
  }

  const header = (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
      <p className="note">
        {rows.length
          ? `${features.length} features from ${brief.product_name} against ${adoption.sample_ids.length} personas, ${adoption.sample_ids.length / roles.length} per role.`
          : `${features.length} features ready from ${brief.product_name}.`}
      </p>
      <button className="btn primary" disabled={busy} onClick={onRun}><Icon name="play" />{live ? (rows.length ? 'Run adoption again' : 'Run adoption') : 'Add an API key to run'}</button>
    </div>
  );

  if (!rows.length) return <>{header}<div className="panel empty">Run adoption to see how each persona takes to each feature at 90 days and 12 months.</div></>;

  const personas = adoption.sample_ids.map((id) => personasById[id]).filter((p) => p?.role === selRole);
  const rowFor = (pid, fid) => rows.find((r) => r.persona_id === pid && r.feature_id === fid);
  const cellRows = (agg[selFeat]?.[selRole]?.rows ?? []).slice().sort((a, b) => b.enthusiasm - a.enthusiasm);
  const selFeature = features.find((f) => f.id === selFeat);

  return (
    <>
      {header}
      <div className="panel findings">
        <h2 className="panel-title">What stands out</h2>
        <ul>{notes.map((n) => <li key={n.text} className={n.kind}>{n.text}</li>)}</ul>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Enthusiasm by feature and role</h2>
          <p>Average 0–100. A dot marks who the PRD built it for. Click a cell to see the personas behind it.</p>
        </div>
        <div className="panel">
          <div className="matrix-wrap">
            <table className="matrix adopt">
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  {roles.map((r) => <th key={r.key} scope="col" className="vcol">{r.label}</th>)}
                  <th scope="col" className="vcol">All roles</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.id}>
                    <th scope="row" className="seg">{f.name}<small>{f.setup_effort} setup</small></th>
                    {roles.map((r) => {
                      const s = agg[f.id][r.key];
                      const on = selFeat === f.id && selRole === r.key;
                      return (
                        <td key={r.key} className="cell">
                          {s ? (
                            <button
                              className={`cell-inner cell-btn ${on ? 'selected' : ''}`}
                              style={scoreTint(s.enth)}
                              onClick={() => setSel({ fid: f.id, role: r.key })}
                              aria-pressed={on}
                              title={`${r.label}, ${f.name}: enthusiasm ${Math.round(s.enth)}, ${Math.round(s.a90)}% at 90 days, ${Math.round(s.a12)}% at 12 months`}
                            >
                              {Math.round(s.enth)}
                              {f.primary_roles.includes(r.key) && <span className="built-for" aria-label="Built for this role" />}
                            </button>
                          ) : <div className="cell-inner">–</div>}
                        </td>
                      );
                    })}
                    <td className="cell">
                      <div className="cell-inner all-col">{Math.round(agg[f.id].all?.enth ?? 0)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Short-term and long-term adoption</h2>
          <div className="tabs" role="tablist" aria-label="Role">
            <button role="tab" aria-selected={timeRole === 'all'} onClick={() => setTimeRole('all')}>All roles</button>
            {roles.map((r) => <button key={r.key} role="tab" aria-selected={timeRole === r.key} onClick={() => setTimeRole(r.key)}>{r.label}</button>)}
          </div>
        </div>
        <div className="panel">
          <Dumbbell features={features} agg={agg} roleKey={timeRole} />
          <div className="matrix-legend">
            <span><span className="db-key ring" />Using it at 90 days</span>
            <span><span className="db-key fill grow" />At 12 months, growing</span>
            <span><span className="db-key fill fade" />At 12 months, fading</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Every persona, every feature</h2>
          <div className="tabs" role="tablist" aria-label="Role">
            {roles.map((r) => <button key={r.key} role="tab" aria-selected={selRole === r.key} onClick={() => setSel({ fid: selFeat, role: r.key })}>{r.label}</button>)}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data persona-grid">
            <thead>
              <tr>
                <th>Persona</th>
                {features.map((f) => (
                  <th key={f.id} className={`fcol ${f.id === selFeat ? 'on' : ''}`}>
                    <button className="toggle-link" onClick={() => setSel({ fid: f.id, role: selRole })} title={f.name}>{f.short}</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {personas.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <Avatar name={p.name} />
                      <div><b>{p.name}</b><div className="note">{p.title}, {p.industry}</div></div>
                      <PainChip level={p.pain_level} />
                    </div>
                  </td>
                  {features.map((f) => {
                    const r = rowFor(p.id, f.id);
                    return (
                      <td key={f.id} className={`pg-cell ${f.id === selFeat ? 'on' : ''}`}>
                        {r ? (
                          <span className="pg-chip" style={scoreTint(r.enthusiasm)} title={`${r.note} (90 days ${r.adopt_90d}%, 12 months ${r.adopt_12m}%)`}>
                            {r.enthusiasm}
                          </span>
                        ) : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selFeature && (
          <div className="panel voices">
            <div className="section-head">
              <h2>{(PLURALS[roleLabel[selRole]] ?? `${roleLabel[selRole]}s`).replace(/^./, (c) => c.toUpperCase())} on {selFeature.name.toLowerCase()}</h2>
              <p>{selFeature.description}</p>
            </div>
            {groupNotes(cellRows).map(({ r, others }) => {
              const p = personasById[r.persona_id];
              return (
                <div className="voice" key={r.persona_id}>
                  <span className="pg-chip" style={scoreTint(r.enthusiasm)}>{r.enthusiasm}</span>
                  <div>
                    <blockquote>“{r.note}”</blockquote>
                    <div className="note">
                      {p.name}, {p.title}, {p.industry}{others ? `, and ${others} other${others > 1 ? 's' : ''} who said much the same` : ''}.
                      {' '}Using it: {r.adopt_90d}% at 90 days, {r.adopt_12m}% at 12 months.{' '}
                      <button className="toggle-link" onClick={() => onTalk(p.id)}>Talk to {p.name.split(' ')[0]}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
