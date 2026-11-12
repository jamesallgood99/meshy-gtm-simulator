import React, { useMemo, useState } from 'react';
import { Avatar, PainChip, scoreTint } from './ui.jsx';
import { PAIN_ORDER } from '../lib/stats.js';

export const MAX_PICKED = 12;

/**
 * Choose whose verbatims to read. `candidates` is [{ p, score }] for everyone who reacted.
 * `picked` is an array of persona ids, or null for the suggested set.
 */
export default function PersonaPicker({ candidates, roles, picked, onChange, suggestedNote }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('all');
  const [pain, setPain] = useState('all');
  const [q, setQ] = useState('');
  const chosen = picked ?? [];
  const custom = picked !== null && picked !== undefined;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return candidates
      .filter(({ p }) => (role === 'all' || p.role === role) && (pain === 'all' || p.pain_level === pain))
      .filter(({ p }) => !needle || `${p.name} ${p.title} ${p.company} ${p.industry}`.toLowerCase().includes(needle))
      .sort((a, b) => b.score - a.score);
  }, [candidates, role, pain, q]);

  const toggle = (id) => {
    if (chosen.includes(id)) {
      const next = chosen.filter((x) => x !== id);
      onChange(next.length ? next : null);
    } else if (chosen.length < MAX_PICKED) {
      onChange([...chosen, id]);
    }
  };

  return (
    <div className="picker">
      <div className="picker-bar">
        <span className="note">
          {custom ? `Showing ${chosen.length} persona${chosen.length > 1 ? 's' : ''} you picked.` : suggestedNote}
        </span>
        <div className="row" style={{ gap: 8 }}>
          {custom && <button className="toggle-link" onClick={() => onChange(null)}>Back to suggested</button>}
          <button className="btn small" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Done choosing' : 'Choose personas'}
          </button>
        </div>
      </div>
      {open && (
        <div className="panel picker-panel">
          <div className="row picker-filters">
            <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
              <option value="all">All roles</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
            <select value={pain} onChange={(e) => setPain(e.target.value)} aria-label="Pain level">
              <option value="all">Any pain level</option>
              {PAIN_ORDER.map((l) => <option key={l} value={l}>{l} pain</option>)}
            </select>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, company or industry" aria-label="Search personas" />
            <span className="note">{chosen.length}/{MAX_PICKED} picked · {list.length} match</span>
          </div>
          <ul className="picker-list">
            {list.map(({ p, score }) => {
              const on = chosen.includes(p.id);
              const full = !on && chosen.length >= MAX_PICKED;
              return (
                <li key={p.id}>
                  <label className={`picker-row ${on ? 'on' : ''} ${full ? 'full' : ''}`}>
                    <input type="checkbox" checked={on} disabled={full} onChange={() => toggle(p.id)} />
                    <Avatar name={p.name} />
                    <span className="picker-who"><b>{p.name}</b><small>{p.title}, {p.industry}</small></span>
                    <PainChip level={p.pain_level} />
                    <span className="pg-chip" style={scoreTint(score)} title="Their score">{score}</span>
                  </label>
                </li>
              );
            })}
            {!list.length && <li className="note" style={{ padding: 10 }}>No personas match.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
