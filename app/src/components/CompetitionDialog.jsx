import React, { useState } from 'react';
import { Dialog, Icon, variantVars } from './ui.jsx';
import { OURS } from '../lib/competition.js';

export const MAX_COMPETITORS = 3;

const slug = (name, taken) => {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'competitor';
  let s = base;
  for (let i = 2; taken.includes(s) || s === OURS; i++) s = `${base}-${i}`;
  return s;
};

export default function CompetitionDialog({ comp, brief, live, onSave, onMap, onClose }) {
  const features = brief.features;
  const [c, setC] = useState(() => {
    const copy = JSON.parse(JSON.stringify({ competitors: comp.competitors, features: comp.features, messages: comp.messages }));
    for (const f of features) {
      copy.messages[f.id] ??= {};
      copy.messages[f.id][OURS] ??= f.description;
    }
    return copy;
  });
  const [paste, setPaste] = useState({});
  const [mapping, setMapping] = useState(null);
  const [mapError, setMapError] = useState('');

  const keyFor = (x) => x.id || x.tmp;
  const setComp = (i, k, v) => setC({ ...c, competitors: c.competitors.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const setMsg = (fid, brand, v) => setC({ ...c, messages: { ...c.messages, [fid]: { ...c.messages[fid], [brand]: v } } });
  const toggle = (fid) => setC({
    ...c,
    features: c.features.includes(fid) ? c.features.filter((x) => x !== fid) : features.map((f) => f.id).filter((id) => id === fid || c.features.includes(id)),
  });
  const add = () => setC({ ...c, competitors: [...c.competitors, { id: '', tmp: `tmp-${Date.now()}`, name: '', positioning: '', source: 'Added by hand' }] });
  const remove = (i) => {
    const gone = keyFor(c.competitors[i]);
    const messages = Object.fromEntries(Object.entries(c.messages).map(([fid, m]) => {
      const { [gone]: _drop, ...rest } = m;
      return [fid, rest];
    }));
    setC({ ...c, competitors: c.competitors.filter((_, j) => j !== i), messages });
  };

  // Give new competitors a stable id from their name, and move any messages typed before naming.
  const normalized = () => {
    const taken = c.competitors.map((x) => x.id).filter(Boolean);
    const rename = {};
    const competitors = c.competitors.filter((x) => x.name.trim()).map(({ tmp, ...x }) => {
      const id = x.id || slug(x.name, taken);
      if (!x.id) { taken.push(id); rename[tmp] = id; }
      return { ...x, id, name: x.name.trim() };
    });
    const keep = new Set([OURS, ...competitors.map((x) => x.id)]);
    const messages = Object.fromEntries(Object.entries(c.messages).map(([fid, m]) => [
      fid, Object.fromEntries(Object.entries(m).map(([k, v]) => [rename[k] ?? k, v]).filter(([k]) => keep.has(k))),
    ]));
    return { competitors, features: c.features, messages };
  };

  const map = async (i) => {
    const x = c.competitors[i];
    setMapError('');
    setMapping(i);
    try {
      const res = await onMap(x.name, paste[i]);
      const k = keyFor(x);
      const messages = { ...c.messages };
      for (const [fid, msg] of Object.entries(res.messages)) messages[fid] = { ...messages[fid], [k]: msg };
      const featureIds = features.map((f) => f.id).filter((id) => c.features.includes(id) || res.messages[id]);
      setC({
        ...c,
        features: featureIds,
        messages,
        competitors: c.competitors.map((y, j) => (j === i ? { ...y, positioning: y.positioning || res.positioning, source: 'Mapped from their copy by Claude' } : y)),
      });
    } catch (e) {
      setMapError(e.message);
    } finally {
      setMapping(null);
    }
  };

  const named = c.competitors.filter((x) => x.name.trim());
  const valid = named.length > 0 && c.features.length > 0 && c.features.every((fid) => c.messages[fid]?.[OURS]?.trim());

  return (
    <Dialog
      title="Edit competitors"
      wide
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn" disabled={!valid} onClick={() => onSave(normalized(), false)}>Save</button>
        {live && <button className="btn primary" disabled={!valid} onClick={() => onSave(normalized(), true)}>Save and run head-to-head</button>}
      </>}
    >
      <h3 className="dialog-sub">Competitors</h3>
      {c.competitors.map((x, i) => (
        <div className="variant-edit" key={i} style={variantVars(i + 1)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ color: 'var(--vc)' }}>{x.name || `Competitor ${i + 1}`}</b>
            <button className="toggle-link" onClick={() => remove(i)}>Remove</button>
          </div>
          <input type="text" value={x.name} onChange={(e) => setComp(i, 'name', e.target.value)} placeholder="Company name" aria-label="Company name" />
          <input type="text" value={x.positioning} onChange={(e) => setComp(i, 'positioning', e.target.value)} placeholder="How they position themselves, in a sentence (for your reference)" aria-label="Positioning" />
          <details>
            <summary>Paste their copy and map it to our features</summary>
            <textarea rows={4} value={paste[i] ?? ''} onChange={(e) => setPaste({ ...paste, [i]: e.target.value })}
              placeholder="Their homepage, product pages, a deck or ads. Claude pulls out what they say about each of our features, in their words." aria-label="Their copy" />
            <div className="row">
              <button className="btn small" disabled={!live || !x.name.trim() || !paste[i]?.trim() || mapping !== null} onClick={() => map(i)}>
                <Icon name="docs" />{mapping === i ? 'Mapping…' : live ? 'Map to our features' : 'Add an API key to map'}
              </button>
              <span className="note">Their own words only. Features they don't address stay blank.</span>
            </div>
          </details>
        </div>
      ))}
      {mapError && <p className="banner error">{mapError}</p>}
      {c.competitors.length < MAX_COMPETITORS && <button className="btn" onClick={add}>Add a competitor</button>}

      <h3 className="dialog-sub">Messages by feature</h3>
      <p className="note">Tick the features to compare. Our message starts from the PRD description, so rewrite it as the copy you'd actually ship. Leave a competitor blank if they don't message that feature: an empty column is a finding too.</p>
      {features.map((f) => {
        const on = c.features.includes(f.id);
        return (
          <div className={`feature-edit ${on ? 'on' : ''}`} key={f.id}>
            <label className="row" style={{ fontWeight: 600 }}>
              <input type="checkbox" checked={on} onChange={() => toggle(f.id)} />
              {f.name}
            </label>
            {on && (
              <>
                <label className="field msg-field" style={variantVars(0)}>
                  <span>{(brief.product_name ?? 'Us').split(' ')[0]} (us)</span>
                  <textarea rows={2} value={c.messages[f.id]?.[OURS] ?? ''} onChange={(e) => setMsg(f.id, OURS, e.target.value)} />
                </label>
                {c.competitors.map((x, i) => (
                  <label className="field msg-field" key={i} style={variantVars(i + 1)}>
                    <span>{x.name || `Competitor ${i + 1}`}</span>
                    <textarea rows={2} value={c.messages[f.id]?.[keyFor(x)] ?? ''} onChange={(e) => setMsg(f.id, keyFor(x), e.target.value)}
                      placeholder="Leave blank if they don't message this" />
                  </label>
                ))}
              </>
            )}
          </div>
        );
      })}
      <p className="note">Every message runs blind against the same personas: brand names are swapped for "the vendor" before scoring.</p>
    </Dialog>
  );
}
