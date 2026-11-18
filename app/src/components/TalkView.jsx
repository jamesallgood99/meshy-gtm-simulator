import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, PainChip, Icon } from './ui.jsx';
import { VETO } from '../lib/stats.js';

function suggestions(analysis) {
  if (!analysis) return [];
  const { winner, personasById } = analysis;
  const rows = winner.rows.map((r) => ({ ...r, p: personasById[r.persona_id] })).filter((r) => r.p);
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const champion = sorted[0];
  const skeptic = [...rows].filter((r) => VETO.has(r.p.role)).sort((a, b) => a.score - b.score)[0];
  const middle = [...rows].sort((a, b) => Math.abs(a.score - 50) - Math.abs(b.score - 50)).find((r) => r !== champion && r !== skeptic);
  return [
    champion && { ...champion, why: `Champion: scored ${champion.score} on ${winner.variant.name}` },
    skeptic && { ...skeptic, why: `Skeptic with a veto: scored ${skeptic.score}` },
    middle && { ...middle, why: `On the fence: scored ${middle.score}` },
  ].filter(Boolean);
}

export default function TalkView({ market, analysis, live, busy, personaId, onSelect, transcripts, onSend }) {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [roleKey, setRoleKey] = useState('all');
  const [size, setSize] = useState('all');
  const endRef = useRef(null);
  const sugg = useMemo(() => suggestions(analysis), [analysis]);
  const persona = market.personas.find((p) => p.id === personaId) ?? sugg[0]?.p ?? market.personas[0];
  const transcript = transcripts[persona.id] ?? [];

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'nearest' }); }, [transcript.length, busy]);

  // Company sizes in market order (smallest first), labelled with the segment they belong to.
  const sizes = useMemo(() => {
    const seen = new Map();
    for (const s of market.segments ?? []) if (!seen.has(s.size_band)) seen.set(s.size_band, s.label);
    for (const p of market.personas) if (!seen.has(p.size_band)) seen.set(p.size_band, p.industry);
    return [...seen].map(([band, label]) => ({ band, label }));
  }, [market]);
  const countFor = (r, z) => market.personas.filter((p) => (r === 'all' || p.role === r) && (z === 'all' || p.size_band === z)).length;

  const filtering = roleKey !== 'all' || size !== 'all' || query.trim().length > 1;
  const pool = market.personas.filter((p) =>
    (roleKey === 'all' || p.role === roleKey) &&
    (size === 'all' || p.size_band === size) &&
    (query.trim().length < 2 || `${p.name} ${p.title} ${p.company} ${p.industry} ${p.role_label}`.toLowerCase().includes(query.toLowerCase())));
  const matches = filtering ? pool.slice(0, 8) : [];

  // Picking a persona or size jumps the chat to the first person who fits, so the page answers right away.
  const pickFilter = (r, z) => {
    setRoleKey(r);
    setSize(z);
    const first = market.personas.find((p) => (r === 'all' || p.role === r) && (z === 'all' || p.size_band === z));
    if ((r !== 'all' || z !== 'all') && first) onSelect(first.id);
  };

  const send = () => {
    if (!draft.trim() || busy) return;
    onSend(persona, draft.trim());
    setDraft('');
  };

  return (
    <div className="talk">
      <div className="persona-pick">
        <div className="section-head"><h2>Who to talk to</h2></div>
        {sugg.map((s) => (
          <button key={s.p.id} className="persona-option" aria-pressed={s.p.id === persona.id} onClick={() => onSelect(s.p.id)}>
            <Avatar name={s.p.name} />
            <div>
              <div className="why">{s.why}</div>
              <div className="name">{s.p.name}</div>
              <div className="meta">{s.p.title}, {s.p.industry}</div>
            </div>
          </button>
        ))}
        <label className="field" style={{ marginTop: 6 }}>
          Persona
          <select value={roleKey} onChange={(e) => pickFilter(e.target.value, size)}>
            <option value="all">All personas</option>
            {market.roles.map((r) => {
              const n = countFor(r.key, size);
              return <option key={r.key} value={r.key} disabled={n === 0}>{r.label} ({n})</option>;
            })}
          </select>
        </label>
        <label className="field">
          Company size
          <select value={size} onChange={(e) => pickFilter(roleKey, e.target.value)}>
            <option value="all">All sizes</option>
            {sizes.map((z) => {
              const n = countFor(roleKey, z.band);
              return <option key={z.band} value={z.band} disabled={n === 0}>{z.band} employees ({n})</option>;
            })}
          </select>
        </label>
        <label className="field">
          Or search by name
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, title, company or industry" />
        </label>
        {filtering && <p className="note" style={{ margin: 0 }}>{pool.length === 0 ? 'No one matches. Try another persona or size.' : `${pool.length} match${pool.length === 1 ? '' : 'es'}${pool.length > matches.length ? `, showing ${matches.length}` : ''}.`}</p>}
        {matches.map((p) => (
          <button key={p.id} className="persona-option" aria-pressed={p.id === persona.id} onClick={() => onSelect(p.id)}>
            <Avatar name={p.name} />
            <div>
              <div className="name">{p.name}</div>
              <div className="meta">{p.title} at {p.company}, {p.size_band} employees · {p.pain_level} pain</div>
            </div>
          </button>
        ))}
      </div>

      <div className="chat">
        <div className="chat-head">
          <Avatar name={persona.name} size="lg" />
          <div style={{ flex: 1 }}>
            <b>{persona.name}</b>
            <div className="meta">{persona.title} at {persona.company}, {persona.company_type ?? persona.industry} ({persona.industry}), {persona.size_band} employee{persona.size_band === '1' ? '' : 's'}. {persona.buying_role}{persona.veto ? ', can block the deal' : ''}.</div>
            <div className="meta">Right now: {persona.trigger}.{persona.current_tool ? ` Uses today: ${persona.current_tool}.` : ''}</div>
          </div>
          <PainChip level={persona.pain_level} />
        </div>
        <details className="pain-list" open>
          <summary>
            {persona.name.split(' ')[0]}'s pain points <span className="note">({persona.pains.length}, strongest first. Intensity varies by company, so the same role feels these differently elsewhere.)</span>
          </summary>
          <ul>
            {persona.pains.map((x) => (
              <li key={x.key} className={x.source === 'industry' ? 'industry' : ''}>
                <div className="pain-head">
                  <b>{x.label}</b>
                  {x.source === 'industry' && <span className="tag">{persona.company_type ?? 'company'}-specific</span>}
                  <span className="pain-meter" role="img" aria-label={`Intensity ${x.intensity.toFixed(2)} of 1`}>
                    <span style={{ width: `${x.intensity * 100}%` }} />
                  </span>
                  <span className="n">{x.intensity.toFixed(2)}</span>
                </div>
                <div className="note">{x.description}</div>
              </li>
            ))}
          </ul>
        </details>
        <div className="msgs" aria-live="polite">
          {transcript.length === 0 && (
            <div className="empty">
              {live
                ? `Pitch ${persona.name.split(' ')[0]} the way you would on a first call. They'll push back the way their role and pains would.`
                : 'Demo mode includes one sample interview. Add your Claude API key in Settings to talk to anyone in the market.'}
            </div>
          )}
          {transcript.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.text}</div>)}
          {busy && <div className="msg persona typing">{persona.name.split(' ')[0]} is typing…</div>}
          <div ref={endRef} />
        </div>
        <div className="chat-input">
          <textarea
            rows={1}
            value={draft}
            disabled={!live}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={live ? `Message ${persona.name.split(' ')[0]}` : 'Add an API key in Settings to start talking'}
            aria-label="Your message"
          />
          <button className="btn primary" onClick={send} disabled={!live || busy || !draft.trim()}><Icon name="send" />Send</button>
        </div>
      </div>
    </div>
  );
}
