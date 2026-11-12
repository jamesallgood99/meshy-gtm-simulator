import React, { useMemo, useState } from 'react';
import { scoreTint, Icon } from './ui.jsx';
import { VETO, PLURALS } from '../lib/stats.js';
import { CHANNELS, aggregateChannels, channelFindings, ranked } from '../lib/channels.js';

const chanById = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

/** Collapse identical notes so the list shows distinct points of view. */
function groupNotes(rows) {
  const groups = new Map();
  for (const r of rows) {
    const k = r.note.trim().toLowerCase();
    if (!groups.has(k)) groups.set(k, { r, others: 0 });
    else groups.get(k).others++;
  }
  return [...groups.values()];
}

export default function ChannelsView({ market, campaign, channels, live, busy, onRun, onTalk }) {
  const variants = campaign?.variants ?? [];
  const [vid, setVid] = useState(() => variants.find((v) => channels?.[v.id])?.id ?? variants[0]?.id);
  const [by, setBy] = useState('segment');
  const [sel, setSel] = useState(null);
  const run = channels?.[vid];
  const variant = variants.find((v) => v.id === vid);
  const agg = useMemo(() => (run ? aggregateChannels(market, run.rows) : null), [market, run]);
  const notes = useMemo(() => (agg ? channelFindings(market, agg) : []), [market, agg]);
  const roleLabel = Object.fromEntries(market.roles.map((r) => [r.key, r.label]));

  const segRows = (market.segments ?? []).map((s) => ({ key: s.label, name: s.label, group: 'segment' }));
  const roleRows = (market.segments ?? [{ roles: market.roles.map((r) => r.key) }]).flatMap((s) =>
    s.roles.map((k) => ({ key: k, name: roleLabel[k], group: 'role', veto: VETO.has(k), seg: s.label })));
  const rows = (by === 'segment' ? segRows : roleRows).filter((r) => agg?.[r.group]?.[r.key]);
  const current = sel && sel.by === by ? sel : (rows[0] ? { by, key: rows[0].key, c: ranked(agg?.[rows[0].group]?.[rows[0].key])[0]?.c } : null);
  const cellRows = current ? (agg?.[by === 'segment' ? 'segment' : 'role']?.[current.key]?.[current.c]?.rows ?? []).slice().sort((a, b) => b.receptivity - a.receptivity) : [];
  const selName = current ? (by === 'segment' ? current.key : PLURALS[roleLabel[current.key]] ?? roleLabel[current.key]) : '';

  const header = (
    <>
      <div className="tabs" role="tablist" aria-label="Message" style={{ marginBottom: 12 }}>
        {variants.map((v) => (
          <button key={v.id} role="tab" aria-selected={v.id === vid} onClick={() => { setVid(v.id); setSel(null); }}>
            {v.name}{channels?.[v.id] ? '' : ' (not run)'}
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14, alignItems: 'flex-start' }}>
        <div style={{ maxWidth: 760 }}>
          <p><b>{variant?.headline}</b></p>
          <p className="note">
            {run
              ? `${CHANNELS.length} channels, rated by ${run.sample_ids.length} personas (equal by segment). Each persona rates the same message in every channel.`
              : `${CHANNELS.length} channels ready. A run rates this message in every channel for a 48-persona sample.`}
          </p>
        </div>
        <button className="btn primary" disabled={busy || !variant} onClick={() => onRun(variant)}>
          <Icon name="play" />{live ? (run ? 'Run channels again' : 'Run channels') : 'Add an API key to run'}
        </button>
      </div>
    </>
  );

  if (!run) return <>{header}<div className="panel empty">Run channels to see where each persona is most receptive to this message: social, email, message boards, video, events, billboards, TV and more.</div></>;

  return (
    <>
      {header}
      <div className="panel findings">
        <h2 className="panel-title">What stands out</h2>
        <ul>{notes.map((n) => <li key={n.text} className={n.kind}>{n.text}</li>)}</ul>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Receptivity by channel</h2>
          <div className="tabs" role="tablist" aria-label="Group by">
            <button role="tab" aria-selected={by === 'segment'} onClick={() => setBy('segment')}>By segment</button>
            <button role="tab" aria-selected={by === 'role'} onClick={() => setBy('role')}>By role</button>
          </div>
        </div>
        <div className="panel">
          <p className="note" style={{ marginBottom: 10 }}>Average 0–100: how likely this message, met in this channel, gets their attention and a next step. A dot marks each row's best channel. Click a cell to see the personas behind it.</p>
          <div className="matrix-wrap">
            <table className="matrix adopt">
              <thead>
                <tr>
                  <th scope="col">{by === 'segment' ? 'Segment' : 'Role'}</th>
                  {CHANNELS.map((c) => <th key={c.id} scope="col" className="vcol" title={`${c.label}: ${c.detail}`}>{c.short}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const stats = agg[r.group][r.key];
                  const best = ranked(stats)[0]?.c;
                  const newSeg = by === 'role' && r.seg !== rows[i - 1]?.seg;
                  return (
                    <React.Fragment key={r.key}>
                      {newSeg && <tr className="group"><td colSpan={CHANNELS.length + 1}>{r.seg}</td></tr>}
                      <tr>
                        <th scope="row" className="seg">
                          {r.name}
                          <small>{r.veto ? 'can block the deal' : `n=${stats[CHANNELS[0].id]?.n ?? 0}`}</small>
                        </th>
                        {CHANNELS.map((c) => {
                          const s = stats[c.id];
                          const on = current?.key === r.key && current?.c === c.id;
                          return (
                            <td key={c.id} className="cell">
                              {s ? (
                                <button className={`cell-inner cell-btn ${on ? 'selected' : ''}`} style={scoreTint(s.mean)}
                                  onClick={() => setSel({ by, key: r.key, c: c.id })} aria-pressed={on}
                                  title={`${r.name}, ${c.label}: ${Math.round(s.mean)} average across ${s.n} personas`}>
                                  {Math.round(s.mean)}
                                  {c.id === best && <span className="built-for" aria-label="Best channel for this row" />}
                                </button>
                              ) : <div className="cell-inner">–</div>}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Where to spend, by segment</h2>
          <p>Top channels for this message in each segment, and the one to skip</p>
        </div>
        <div className="role-pains">
          {segRows.filter((s) => agg.segment[s.key]).map((s) => {
            const list = ranked(agg.segment[s.key]);
            const worst = list.at(-1);
            return (
              <div className="panel" key={s.key}>
                <h3>{s.name}</h3>
                {list.slice(0, 4).map(({ c, s: st }) => (
                  <div className="pain-line" key={c}>
                    <span>{chanById[c].label}</span>
                    <span className="n">{Math.round(st.mean)}</span>
                    <div className="track"><div className="fill" style={{ width: `${st.mean}%` }} /></div>
                  </div>
                ))}
                {worst && <p className="note" style={{ marginTop: 8 }}>Skip: {chanById[worst.c].label} ({Math.round(worst.s.mean)})</p>}
              </div>
            );
          })}
        </div>
      </section>

      {current && (
        <section className="section">
          <div className="panel voices">
            <div className="section-head">
              <h2>{selName.replace(/^./, (c) => c.toUpperCase())} on {chanById[current.c].label.replace(/^(?!TV|LinkedIn|YouTube)./, (c) => c.toLowerCase())}</h2>
              <p>{chanById[current.c].detail}</p>
            </div>
            {groupNotes(cellRows).map(({ r, others }) => {
              const p = agg.personasById[r.persona_id];
              return (
                <div className="voice" key={r.persona_id}>
                  <span className="pg-chip" style={scoreTint(r.receptivity)}>{r.receptivity}</span>
                  <div>
                    <blockquote>“{r.note}”</blockquote>
                    <div className="note">
                      {p.name}, {p.title}, {p.company_type ?? p.industry}{others ? `, and ${others} other${others > 1 ? 's' : ''} who said much the same` : ''}.{' '}
                      <button className="toggle-link" onClick={() => onTalk(p.id)}>Talk to {p.name.split(' ')[0]}</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
