import React, { useState } from 'react';
import Histogram from './Histogram.jsx';
import SegmentMatrix from './SegmentMatrix.jsx';
import Quotes from './Quotes.jsx';
import PersonaPicker from './PersonaPicker.jsx';
import { Icon, variantVars, variantColor, pct, r0 } from './ui.jsx';
import { pickQuotes } from '../lib/analysis.js';

export function VariantCards({ variants }) {
  return (
    <div className="variant-row" style={{ gridTemplateColumns: `repeat(${variants.length}, 1fr)` }}>
      {variants.map((v, i) => (
        <article key={v.id} className="variant-card" style={variantVars(i)}>
          <div className="tag">{v.name}</div>
          <h3>{v.headline || v.message.split(/[.!?]/)[0]}</h3>
          <p className="focus">{v.focus}</p>
          <p className="copy">{v.message}</p>
        </article>
      ))}
    </div>
  );
}

export function DistCard({ pv, isWinner, multi, wide }) {
  const { mc, variant, index } = pv;
  return (
    <article className="dist-card" style={variantVars(index)}>
      <div className="dist-head">
        <h3>{variant.name}</h3>
        <span className="mean-badge">Mean interest {r0(mc.mean)}/100</span>
      </div>
      <Histogram mc={mc} color={variantColor(index)} width={wide ? 560 : 360} height={wide ? 230 : 190} />
      <div className="dist-stats">
        <div>
          <b>{r0(mc.p80)}</b>
          <span>Top-20% outcome (P80)</span>
        </div>
        <div>
          <b>{pct(mc.pAbove)}</b>
          <span>Score above 70</span>
          <small>80% range {pct(mc.pAboveCI[0])}–{pct(mc.pAboveCI[1])}</small>
        </div>
        <div>
          <b>{r0(mc.meanCI[0])}–{r0(mc.meanCI[1])}</b>
          <span>Mean, 80% range</span>
          {multi && isWinner && <small className="winner-flag">Most likely to land</small>}
        </div>
      </div>
    </article>
  );
}

const roleNoun = (label) => {
  const first = label.split(' ')[0];
  const base = first === first.toUpperCase() ? label : label[0].toLowerCase() + label.slice(1);
  return `${base}s`;
};

function Recommendation({ analysis }) {
  const { winner, runnerUp, vetoLosses, overlap, perVariant } = analysis;
  if (perVariant.length < 2) return null;
  return (
    <div className="reco" style={variantVars(winner.index)} role="status">
      <span className="reco-icon"><Icon name="star" /></span>
      <div>
        <p>
          <b>{winner.variant.name} is most likely to land</b>, with {pct(winner.mc.pAbove)} of personas scoring above 70
          {runnerUp ? ` against ${pct(runnerUp.mc.pAbove)} for ${runnerUp.variant.name}` : ''}.
          {overlap ? ' The ranges overlap, so treat the lead as a tie until real conversations break it.' : ''}
        </p>
        {vetoLosses.length > 0 && (
          <p className="caveat">
            But it loses {vetoLosses.map((v, i) => `${i ? (i === vetoLosses.length - 1 ? ' and ' : ', ') : ''}${roleNoun(v.role)} by ${v.by} points to ${v.to}`).join('')}.
            {' '}Those roles can block a deal, so the split is the finding, not the average.
          </p>
        )}
      </div>
    </div>
  );
}

export default function CompareView({ campaign, analysis, sampleSize, onTalk, onRun, live, busy }) {
  const [quoteVariant, setQuoteVariant] = useState(null);
  const [picked, setPicked] = useState(null);
  if (!analysis) {
    return (
      <>
        <VariantCards variants={campaign.variants} />
        <div className="panel empty" style={{ marginTop: 16 }}>
          <p>These messages haven't met the market yet.</p>
          <p style={{ marginTop: 12 }}>
            <button className="btn primary" disabled={busy} onClick={onRun}><Icon name="play" />{live ? 'Run simulation' : 'Add an API key to run'}</button>
          </p>
        </div>
      </>
    );
  }
  const { perVariant, winner, personasById } = analysis;
  const selected = perVariant.find((pv) => pv.variant.id === quoteVariant) ?? winner;
  const quotes = picked
    ? picked.map((id) => selected.rows.find((r) => r.persona_id === id)).filter((r) => r && personasById[r.persona_id]).map((r) => ({ ...r, p: personasById[r.persona_id] }))
    : pickQuotes(selected.rows, personasById);
  const roles = Object.entries(analysis.roleLabel).map(([key, label]) => ({ key, label }));
  const multi = perVariant.length > 1;

  return (
    <>
      <VariantCards variants={perVariant.map((pv) => pv.variant)} />

      <section className="section">
        <div className="section-head">
          <h2>Simulated response distribution</h2>
          <p>Monte Carlo over {sampleSize} personas per variant, 2,000 simulated markets</p>
        </div>
        <div className="grid-3" style={{ gridTemplateColumns: `repeat(${perVariant.length}, 1fr)` }}>
          {perVariant.map((pv) => <DistCard key={pv.variant.id} pv={pv} isWinner={pv === winner} multi={multi} />)}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Results by segment</h2>
          <p>Read this before the averages. A message can win overall and lose the person who signs.</p>
        </div>
        <SegmentMatrix analysis={analysis} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>What personas are saying</h2>
          {multi && (
            <div className="tabs" role="tablist" aria-label="Show quotes for">
              {perVariant.map((pv) => (
                <button key={pv.variant.id} role="tab" aria-selected={pv === selected} onClick={() => setQuoteVariant(pv.variant.id)}>
                  {pv.variant.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <PersonaPicker
          candidates={selected.rows.filter((r) => personasById[r.persona_id]).map((r) => ({ p: personasById[r.persona_id], score: r.score }))}
          roles={roles} picked={picked} onChange={setPicked}
          suggestedNote="Suggested: one from each pain level, plus the harshest critic. Your picks stay when you switch variants."
        />
        <Quotes quotes={quotes} onTalk={onTalk} />
      </section>

      <Recommendation analysis={analysis} />
    </>
  );
}
