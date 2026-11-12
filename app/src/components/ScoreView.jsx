import React, { useState } from 'react';
import { DistCard } from './CompareView.jsx';
import { QuoteCard } from './Quotes.jsx';
import PersonaPicker from './PersonaPicker.jsx';
import { variantVars } from './ui.jsx';
import { bySegment, mean, PAIN_ORDER } from '../lib/stats.js';
import { topObjections } from '../lib/analysis.js';

function StripPlot({ rows, personasById, attr, order, name }) {
  const segs = bySegment(rows, personasById, attr, order);
  return (
    <div>
      {segs.map((s) => (
        <div className="strip-row" key={s.key}>
          <div className="strip-label">{name(s.key)}<small>{s.n} personas</small></div>
          <div className="strip" aria-label={`${name(s.key)}: scores from ${Math.min(...s.scores)} to ${Math.max(...s.scores)}, average ${Math.round(s.mean)}`}>
            <div className="track" />
            <div className="threshold" style={{ left: '70%' }} />
            {s.scores.map((v, i) => <span key={i} className="dot" style={{ left: `${v}%` }} />)}
            <div className="mean-tick" style={{ left: `${s.mean}%` }} />
          </div>
          <div className="strip-mean">{Math.round(s.mean)}</div>
        </div>
      ))}
      <div className="axis-row">
        <span />
        <div className="ticks"><span>0</span><span>25</span><span>50</span><span>70</span><span>100</span></div>
        <span />
      </div>
    </div>
  );
}

export default function ScoreView({ market, analysis, live, busy, onScoreNew, onTalk }) {
  const [vid, setVid] = useState(null);
  const [roleFilter, setRoleFilter] = useState('all');
  const [draft, setDraft] = useState('');
  const [picked, setPicked] = useState(null);
  if (!analysis) return <div className="panel empty">No results yet.</div>;
  const { perVariant, personasById, roleLabel } = analysis;
  const pv = perVariant.find((x) => x.variant.id === vid) ?? perVariant[0];
  const objections = topObjections(pv.rows);
  const maxObj = Math.max(1, ...objections.map((o) => o.n));
  const enriched = pv.rows.map((r) => ({ ...r, p: personasById[r.persona_id] })).filter((r) => r.p && r.reaction);
  const filtered = enriched
    .filter((r) => roleFilter === 'all' || r.p.role === roleFilter)
    .sort((a, b) => b.score - a.score);
  const shown = filtered.length > 6 ? [...filtered.slice(0, 3), ...filtered.slice(-3)] : filtered;
  const pickedRows = (picked ?? []).map((id) => enriched.find((r) => r.persona_id === id)).filter(Boolean);

  return (
    <>
      <div className="panel composer" style={{ marginBottom: 18 }}>
        <label className="field" htmlFor="new-message">
          Score a new message
          <small>A headline, positioning statement, pricing page or email. It runs against the same persona sample as the campaign.</small>
        </label>
        <textarea id="new-message" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Cut claims, not corners. Coaching that crews actually trust." />
        <div className="row">
          <button className="btn primary" disabled={!draft.trim() || busy} onClick={() => { onScoreNew(draft.trim()); setDraft(''); }}>
            {live ? 'Score message' : 'Add an API key to score'}
          </button>
          <span className="note">{live ? 'Adds it to the campaign as a new variant.' : 'Demo mode shows the sample campaign. Scoring new copy needs your own Claude API key.'}</span>
        </div>
      </div>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="tabs" role="tablist" aria-label="Variant">
          {perVariant.map((x) => (
            <button key={x.variant.id} role="tab" aria-selected={x === pv} onClick={() => setVid(x.variant.id)}>{x.variant.name}</button>
          ))}
        </div>
      </div>

      <div className="two-col">
        <DistCard pv={pv} multi={false} wide />
        <div className="panel" style={variantVars(pv.index)}>
          <div className="section-head"><h2>What stops them</h2><p>Personas scoring under 70</p></div>
          {objections.length ? objections.map((o) => (
            <div className="objection" key={o.text}>
              <b>{o.text}</b><small>{o.n}</small>
              <div className="bar"><span style={{ width: `${(o.n / maxObj) * 100}%` }} /></div>
            </div>
          )) : <p className="note">No objections recorded.</p>}
        </div>
      </div>

      <section className="section" style={variantVars(pv.index)}>
        <div className="section-head">
          <h2>Every persona, by segment</h2>
          <p>Each dot is one persona. The dark tick is the average, the dashed line is 70.</p>
        </div>
        <div className="panel">
          <StripPlot rows={pv.rows} personasById={personasById} attr="role" order={market.roles.map((r) => r.key)} name={(k) => roleLabel[k]} />
          <div style={{ height: 14 }} />
          <StripPlot rows={pv.rows} personasById={personasById} attr="pain_level" order={PAIN_ORDER} name={(k) => `${k} pain`} />
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Strongest and weakest reactions</h2>
          {!picked && <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ width: 'auto' }} aria-label="Filter by role">
            <option value="all">All roles</option>
            {market.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>}
        </div>
        <PersonaPicker
          candidates={pv.rows.filter((r) => personasById[r.persona_id]).map((r) => ({ p: personasById[r.persona_id], score: r.score }))}
          roles={market.roles} picked={picked} onChange={setPicked}
          suggestedNote={`Showing the three highest and three lowest of ${filtered.length}. Average ${Math.round(mean(filtered.map((r) => r.score)) || 0)}.`}
        />
        <div className="quotes">
          {(picked ? pickedRows : shown).map((r) => <QuoteCard key={r.persona_id} r={r} onTalk={onTalk} />)}
        </div>
      </section>
    </>
  );
}
