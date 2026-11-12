import React, { useMemo, useState } from 'react';
import { Avatar, Icon, PainChip, scoreTint, variantVars, pct, r0 } from './ui.jsx';
import { OURS, pairedQuotes } from '../lib/competition.js';
import PersonaPicker from './PersonaPicker.jsx';
import { PLURALS, andList } from '../lib/stats.js';

const plural = (label) => {
  if (PLURALS[label]) return PLURALS[label];
  const first = label.split(' ')[0];
  const base = first === first.toUpperCase() ? label : label[0].toLowerCase() + label.slice(1);
  return `${base}s`;
};

/** Tooltip text for a competitor cell: the gap stays one hover away instead of on the page. */
function gapTitle(b, x, score, h, scope) {
  const diff = h && (scope === 'main' ? h.diffMain : h.diffAll);
  const v = h && (scope === 'main' ? h.verdict : h.verdictAll);
  const base = `${b.name}, ${x.f.name}: ${r0(score)} average`;
  if (!diff) return base;
  if (v === 'tie') return `${base}. A tie with our message.`;
  return `${base}, ${r0(Math.abs(diff.mean))} points ${diff.mean > 0 ? 'ahead of' : 'behind'} our message.`;
}

function Scoreboard({ analysis, scope, setScope, selected, onSelect }) {
  const { brands, features, roleLabel } = analysis;
  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <p className="note">Average interest, 0–100, from the same personas reading every message. Hover a score for the gap against ours.</p>
        <div className="tabs" role="tablist" aria-label="Score among">
          <button role="tab" aria-selected={scope === 'main'} onClick={() => setScope('main')}>Main personas</button>
          <button role="tab" aria-selected={scope === 'all'} onClick={() => setScope('all')}>All roles</button>
        </div>
      </div>
      <div className="matrix-wrap">
        <table className="matrix h2h">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {brands.map((b) => (
                <th key={b.id} scope="col" className="vcol" style={variantVars(b.index)}>
                  {b.name}{b.id === OURS && <div className="us-tag">Our message</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {features.map((x) => (
              <tr key={x.f.id} className={selected === x.f.id ? 'on' : ''}>
                <th scope="row" className="seg">
                  <button className="toggle-link seg-link" onClick={() => onSelect(x.f.id)} aria-pressed={selected === x.f.id}>{x.f.name}</button>
                  <small>Built for {x.main.map((k) => plural(roleLabel[k] ?? k)).join(', ')}</small>
                </th>
                {brands.map((b) => {
                  const c = x.cells[b.id];
                  if (!c?.scored) {
                    return (
                      <td key={b.id} className="cell">
                        <div className="cell-inner none">{c?.hasMessage ? 'Not run yet' : 'No message'}</div>
                      </td>
                    );
                  }
                  const score = scope === 'main' ? c.main : c.all;
                  const h = x.h2h[b.id];
                  return (
                    <td key={b.id} className="cell">
                      <button
                        className={`cell-inner cell-btn ${h?.[scope === 'main' ? 'verdict' : 'verdictAll'] === 'loss' ? 'flag' : ''}`}
                        style={scoreTint(score)}
                        onClick={() => onSelect(x.f.id, b.id === OURS ? null : b.id)}
                        title={gapTitle(b, x, score, h, scope)}
                      >
                        {r0(score)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matrix-legend">
        <span><span className="swatch" style={{ boxShadow: 'inset 0 0 0 2px var(--flag)' }} />They beat our message</span>
        <span>Main personas are the roles the PRD built the feature for</span>
      </div>
    </div>
  );
}

function RoleBars({ x, brand, ours, them, roleLabel, roles }) {
  const rows = roles.filter((r) => ours.roles[r.key] && them.roles[r.key]).map((r) => ({
    r, main: x.main.includes(r.key), o: ours.roles[r.key].mean, t: them.roles[r.key].mean,
  }));
  const max = Math.max(20, ...rows.map((y) => Math.abs(y.t - y.o)));
  return (
    <div className="role-bars">
      <div className="rb-row rb-head">
        <div />
        <div className="rb-axis"><span>Ours ahead</span><span>{brand.name} ahead</span></div>
        <div className="rb-vals">Us · Them</div>
      </div>
      {rows.map(({ r, main, o, t }) => {
        const d = t - o;
        const w = (Math.abs(d) / max) * 50;
        const side = Math.abs(d) < 3 ? 'even' : d > 0 ? 'them' : 'us';
        return (
          <div className={`rb-row ${main ? 'main' : ''}`} key={r.key}>
            <div className="rb-label">{roleLabel[r.key]}{main && <small>Built for</small>}</div>
            <div className="rb-track" role="img" aria-label={`${roleLabel[r.key]}: us ${r0(o)}, ${brand.name} ${r0(t)}`}>
              <span className="rb-mid" />
              <span className={`rb-bar ${side}`} style={d >= 0 ? { left: '50%', width: `${w}%`, ...variantVars(brand.index) } : { right: '50%', width: `${w}%`, ...variantVars(0) }} />
            </div>
            <div className={`rb-vals ${side}`}><b>{r0(o)}</b> · <b>{r0(t)}</b></div>
          </div>
        );
      })}
    </div>
  );
}

function PairCard({ q, brand, ourName, onTalk }) {
  const { p } = q;
  const theyWin = q.d > 0;
  return (
    <figure className="quote pair">
      <div className="quote-top">
        <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
          <Avatar name={p.name} />
          <div className="who"><b>{p.name}</b><br />{p.role_label}, {p.industry}</div>
        </div>
        <PainChip level={p.pain_level} />
      </div>
      <div className={`pair-side ${theyWin ? '' : 'lead'}`} style={variantVars(0)}>
        <div className="pair-head"><span>{ourName}</span><b>{q.ours.score}</b></div>
        <blockquote>“{q.ours.reaction}”</blockquote>
      </div>
      <div className={`pair-side ${theyWin ? 'lead' : ''}`} style={variantVars(brand.index)}>
        <div className="pair-head"><span>{brand.name}</span><b>{q.theirs.score}</b></div>
        <blockquote>“{q.theirs.reaction}”</blockquote>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="toggle-link" onClick={() => onTalk(p.id)}>Talk to {p.name.split(' ')[0]}</button>
      </div>
    </figure>
  );
}

function HeadToHead({ x, analysis, market, rival, setRival, onTalk, picked, setPicked }) {
  const { brands, roleLabel, personasById, ourName } = analysis;
  const rivals = brands.slice(1).filter((b) => x.cells[b.id]?.scored);
  const brand = rivals.find((b) => b.id === rival) ?? rivals[0];
  const ours = x.cells[OURS];
  const pairs = useMemo(() => {
    if (!brand || !ours?.scored) return [];
    const theirs = new Map(x.cells[brand.id].rows.map((r) => [r.persona_id, r]));
    return ours.rows.filter((o) => theirs.has(o.persona_id) && personasById[o.persona_id]).map((o) => {
      const t = theirs.get(o.persona_id);
      return { p: personasById[o.persona_id], ours: o, theirs: t, d: t.score - o.score };
    });
  }, [x, brand, ours, personasById]);
  const quotes = useMemo(
    () => (picked
      ? picked.map((id) => pairs.find((q) => q.p.id === id)).filter(Boolean)
      : brand && ours?.scored ? pairedQuotes(ours.rows, x.cells[brand.id].rows, personasById, x.main) : []),
    [picked, pairs, x, brand, ours, personasById],
  );

  if (!ours?.scored) return <div className="panel empty">Run the head-to-head to score this feature.</div>;
  if (!brand) {
    return (
      <div className="panel">
        <div className="h2h-msgs" style={{ gridTemplateColumns: '1fr' }}>
          <MsgCard brand={brands[0]} cell={ours} message={x.message.ours} lead />
        </div>
        <p className="note" style={{ marginTop: 12 }}>No competitor messages this feature, so there's nothing to compare. Add their copy in Edit competitors if they do.</p>
      </div>
    );
  }
  const them = x.cells[brand.id];
  const h = x.h2h[brand.id];
  return (
    <>
      {rivals.length > 1 && (
        <div className="tabs" role="tablist" aria-label="Compare against" style={{ marginBottom: 12 }}>
          {rivals.map((b) => (
            <button key={b.id} role="tab" aria-selected={b.id === brand.id} onClick={() => setRival(b.id)}>Us vs. {b.name}</button>
          ))}
        </div>
      )}
      <div className="h2h-msgs">
        <MsgCard brand={brands[0]} cell={ours} message={x.message.ours} lead={h.verdict === 'win'} />
        <MsgCard brand={brand} cell={them} message={x.message[brand.id]} lead={h.verdict === 'loss'} />
      </div>
      <div className={`reco h2h-reco ${h.verdict}`} style={variantVars(h.verdict === 'loss' ? brand.index : 0)} role="status">
        <span className="reco-icon"><Icon name={h.verdict === 'tie' ? 'compare' : 'star'} /></span>
        <p>
          {h.verdict === 'win' && <><b>Our message wins with {andList(x.main.map((k) => plural(roleLabel[k])))}</b> by {r0(-h.diffMain.mean)} points (80% range {r0(-h.diffMain.ci[1])}–{r0(-h.diffMain.ci[0])}).</>}
          {h.verdict === 'loss' && <><b>{brand.name}'s message wins with {andList(x.main.map((k) => plural(roleLabel[k])))}</b> by {r0(h.diffMain.mean)} points (80% range {r0(h.diffMain.ci[0])}–{r0(h.diffMain.ci[1])}). Read their quotes below for what they're doing that we aren't.</>}
          {h.verdict === 'tie' && <><b>No real difference with {andList(x.main.map((k) => plural(roleLabel[k])))}.</b> The gap is {r0(Math.abs(h.diffMain.mean))} points and the range crosses zero. If this feature matters to the deal, neither message owns it yet.</>}
        </p>
      </div>
      <section className="section">
        <div className="section-head">
          <h2>By role</h2>
          <p>The same personas read both messages. Bars show the gap, toward whoever is ahead.</p>
        </div>
        <div className="panel"><RoleBars x={x} brand={brand} ours={ours} them={them} roleLabel={roleLabel} roles={market.roles} /></div>
      </section>
      <section className="section">
        <div className="section-head">
          <h2>Same persona, both messages</h2>
          <p>Where {brand.name} pulls furthest ahead, and where we do.</p>
        </div>
        <PersonaPicker
          candidates={pairs.map((q) => ({ p: q.p, score: q.theirs.score }))}
          roles={market.roles} picked={picked} onChange={setPicked}
          suggestedNote={`Suggested: the two personas ${brand.name} wins most clearly and the two we win most clearly. Scores in the list are for ${brand.name}'s message.`}
        />
        <div className="quotes">
          {quotes.map((q) => <PairCard key={q.p.id} q={q} brand={brand} ourName={analysis.ourName} onTalk={onTalk} />)}
        </div>
      </section>
    </>
  );
}

function MsgCard({ brand, cell, message, lead }) {
  return (
    <article className={`variant-card msg-card ${lead ? 'lead' : ''}`} style={variantVars(brand.index)}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="tag">{brand.id === OURS ? `${brand.name} (us)` : brand.name}</div>
        {lead && <span className="winner-flag">Lands better</span>}
      </div>
      <p className="msg-copy">{message}</p>
      <div className="dist-stats">
        <div><b>{r0(cell.main)}</b><span>Main personas</span></div>
        <div><b>{pct(cell.above)}</b><span>Main personas above 70</span></div>
        <div><b>{r0(cell.all)}</b><span>All roles</span></div>
      </div>
    </article>
  );
}

export default function CompetitionView({ market, brief, comp, analysis, live, busy, cost, onRun, onEdit, onGo, onTalk }) {
  const [scope, setScope] = useState('main');
  const [sel, setSel] = useState({ fid: null, rival: null });
  const [picked, setPicked] = useState(null);

  if (!brief?.features?.length) {
    return (
      <div className="panel empty">
        <p>Competition compares messaging feature by feature, so it needs a feature list. Upload a PRD on the Documents page first.</p>
        <p style={{ marginTop: 12 }}><button className="btn primary" onClick={() => onGo('documents')}>Go to documents</button></p>
      </div>
    );
  }
  if (!comp?.competitors.length || !comp.features.length) {
    return (
      <div className="panel empty">
        <p>Add a competitor and their messaging for the features you overlap on. Paste their own copy and Claude can map it to your features.</p>
        <p style={{ marginTop: 12 }}><button className="btn primary" onClick={onEdit}><Icon name="edit" />Add competitors</button></p>
      </div>
    );
  }

  const features = analysis.features.map((x) => ({ ...x, message: comp.messages[x.f.id] ?? {} }));
  const scored = features.some((x) => x.cells[OURS]?.scored);
  const fid = features.find((x) => x.f.id === sel.fid)?.f.id ?? features.find((x) => x.contested)?.f.id ?? features[0]?.f.id;
  const x = features.find((y) => y.f.id === fid);
  const sampleN = comp.sample_ids?.length ?? 0;

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <p className="note">
          {scored
            ? `${features.length} features against ${comp.competitors.length} competitor${comp.competitors.length > 1 ? 's' : ''}, scored blind by ${sampleN} personas (${Math.round(sampleN / market.roles.length)} per role). Brand names are hidden so personas judge the copy, not the logo.`
            : `${features.length} features and ${comp.competitors.length} competitor${comp.competitors.length > 1 ? 's' : ''} ready. A run is ${cost.calls} API calls (${cost.messages} messages).`}
        </p>
        <button className="btn primary" disabled={busy} onClick={onRun}><Icon name="play" />{live ? (scored ? 'Run head-to-head again' : 'Run head-to-head') : 'Add an API key to run'}</button>
      </div>

      <div className="brand-row">
        {analysis.brands.map((b) => {
          const rec = analysis.record[b.id];
          return (
            <article key={b.id} className="variant-card brand-card" style={variantVars(b.index)}>
              <div className="tag">{b.id === OURS ? 'Us' : 'Competitor'}</div>
              <h3>{b.name}</h3>
              <p className="focus">{b.id === OURS ? (brief.proposition || brief.summary) : b.positioning}</p>
              {rec && scored && (
                <p className="record">
                  {rec.loss > 0 && <span className="h2h-delta loss">Beats us on {rec.loss}</span>}
                  {rec.tie > 0 && <span className="h2h-delta tie">Ties on {rec.tie}</span>}
                  {rec.win > 0 && <span className="h2h-delta win">We win {rec.win}</span>}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {!scored ? (
        <div className="panel empty" style={{ marginTop: 16 }}>
          <p>These messages haven't met the market yet.</p>
        </div>
      ) : (
        <>
          <div className="panel findings" style={{ marginTop: 16 }}>
            <h2 className="panel-title">What stands out</h2>
            <ul>{analysis.findings.map((n) => <li key={n.text} className={`c-${n.kind}`}>{n.text}</li>)}</ul>
          </div>

          <section className="section">
            <div className="section-head">
              <h2>Head-to-head by feature</h2>
              <p>Click a feature or a score to see the messages side by side.</p>
            </div>
            <Scoreboard analysis={{ ...analysis, features }} scope={scope} setScope={setScope} selected={fid} onSelect={(f, rival) => setSel({ fid: f, rival: rival ?? sel.rival })} />
          </section>

          {x && (
            <section className="section">
              <div className="section-head">
                <h2>{x.f.name}</h2>
                <p>{x.f.description}</p>
              </div>
              <HeadToHead key={x.f.id} x={x} analysis={analysis} market={market} rival={sel.rival} setRival={(r) => setSel({ fid, rival: r })} onTalk={onTalk} picked={picked} setPicked={setPicked} />
            </section>
          )}

          <p className="note" style={{ marginTop: 22 }}>
            This tells you whose copy lands harder with the same buyers. It can't tell you which product is better, what their sales team says in the room, or how their brand recognition plays in a real deal. Take the gaps it finds to win-loss interviews.
          </p>
        </>
      )}
    </>
  );
}
