import React from 'react';
import { Avatar, PainChip } from './ui.jsx';

export function QuoteCard({ r, onTalk }) {
  const p = r.p;
  return (
    <figure className="quote">
      <div className="quote-top">
        <Avatar name={p.name} />
        <PainChip level={p.pain_level} />
      </div>
      <blockquote>“{r.reaction}”</blockquote>
      <figcaption className="who">
        {p.name}, {p.title}<br />
        {p.company_type ?? p.industry}, {p.size_band} {p.size_band === '1' ? 'person' : 'employees'}
      </figcaption>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span className="score">Interest {r.score}/100</span>
        {onTalk && <button className="toggle-link" onClick={() => onTalk(p.id)}>Talk to {p.name.split(' ')[0]}</button>}
      </div>
    </figure>
  );
}

export default function Quotes({ quotes, onTalk }) {
  return (
    <div className="quotes">
      {quotes.map((r) => <QuoteCard key={r.persona_id} r={r} onTalk={onTalk} />)}
    </div>
  );
}
