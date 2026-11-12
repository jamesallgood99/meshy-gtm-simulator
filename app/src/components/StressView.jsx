import React, { useMemo, useState } from 'react';
import { Avatar, cap } from './ui.jsx';
import { toughestCritics } from '../lib/stats.js';

function Severity({ n }) {
  return (
    <span className="severity" title={`Severity ${n} of 5`} aria-label={`Severity ${n} of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}
    </span>
  );
}

export default function StressView({ market, live, busy, result, defaultClaim, defaultTheme, onRun }) {
  const [claim, setClaim] = useState(result?.claim ?? defaultClaim ?? '');
  const [theme, setTheme] = useState(result?.theme ?? defaultTheme ?? 'cost');
  const critics = useMemo(() => toughestCritics(market.personas, theme), [market, theme]);
  const byId = useMemo(() => Object.fromEntries(market.personas.map((p) => [p.id, p])), [market]);
  const attacks = result ? [...result.attacks].sort((a, b) => b.severity - a.severity) : [];

  return (
    <>
      <div className="two-col">
        <div className="panel composer">
          <label className="field" htmlFor="claim">
            Your weakest claim
            <small>The line with the least proof behind it. That's the one a skeptical buyer goes after first.</small>
          </label>
          <textarea id="claim" rows={3} value={claim} onChange={(e) => setClaim(e.target.value)} />
          <label className="field" htmlFor="theme">
            What the claim leans on
            <small>Critics are the people who feel this least and have the most to lose.</small>
          </label>
          <select id="theme" value={theme} onChange={(e) => setTheme(e.target.value)}>
            {Object.entries(market.themes ?? {}).map(([k, v]) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}: {v}</option>)}
          </select>
          <div className="row">
            <button className="btn primary" disabled={!claim.trim() || busy} onClick={() => onRun(claim.trim(), critics)}>
              {live ? 'Run the stress test' : 'Add an API key to run'}
            </button>
            {!live && <span className="note">Demo mode shows a sample result for the weakest claim in the sample MRD.</span>}
          </div>
        </div>
        <div className="panel">
          <div className="section-head"><h2>Toughest critics</h2><p>Skepticism, low pain, high stakes</p></div>
          <div className="critics">
            {critics.map((p) => (
              <div className="critic" key={p.id}>
                <Avatar name={p.name} />
                <div>
                  <b>{p.name}</b>, {p.role_label}
                  <div className="meta">{p.industry}. Skepticism {p.skepticism.toFixed(2)}. {cap(p.trigger)}.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {result && (
        <>
          <section className="section">
            <div className="section-head">
              <h2>The attacks</h2>
              <p>Most severe first. 5 means this objection alone kills the deal.</p>
            </div>
            <div className="panel">
              {attacks.map((a) => {
                const p = byId[a.persona_id];
                return (
                  <div className="attack" key={a.persona_id}>
                    <Avatar name={p?.name ?? '?'} />
                    <div>
                      <div className="who"><b>{p?.name ?? a.persona_id}</b>{p ? `${p.title}, ${p.industry}` : ''}<Severity n={a.severity} /></div>
                      <blockquote>“{a.attack}”</blockquote>
                      <div className="needs"><span>What would neutralize it: </span>{a.evidence_needed}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
          <section className="section">
            <div className="panel rewrite">
              <div className="section-head"><h2>A claim that survives</h2></div>
              <p className="before">{result.claim}</p>
              <blockquote>{result.rewrite}</blockquote>
              <p className="note">{result.rewrite_rationale}</p>
            </div>
          </section>
        </>
      )}
    </>
  );
}
