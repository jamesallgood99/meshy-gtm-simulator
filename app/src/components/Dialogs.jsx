import React, { useState } from 'react';
import { Dialog, variantVars } from './ui.jsx';
import { MODELS } from '../lib/anthropic.js';

export function SettingsDialog({ settings, onSave, onClose }) {
  const [s, setS] = useState(settings);
  const set = (k) => (e) => setS({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <Dialog
      title="Settings"
      onClose={onClose}
      footer={<>
        {settings.apiKey && <button className="btn" onClick={() => onSave({ ...s, apiKey: '' })}>Remove key, use demo</button>}
        <button className="btn primary" onClick={() => onSave({ ...s, apiKey: s.apiKey.trim(), sampleSize: Number(s.sampleSize), concurrency: Number(s.concurrency) })}>Save</button>
      </>}
    >
      <label className="field">
        Claude API key
        <small>Get one at console.anthropic.com. The key stays in this browser and is sent only to api.anthropic.com. Runs bill to your account.</small>
        <input type="password" autoComplete="off" value={s.apiKey} onChange={set('apiKey')} placeholder="sk-ant-…" />
      </label>
      <label className="row" style={{ fontSize: 13 }}>
        <input type="checkbox" checked={s.rememberKey} onChange={set('rememberKey')} />
        Remember the key on this device (otherwise it's cleared when you close the tab)
      </label>
      <label className="field">
        Model
        <select value={s.model} onChange={set('model')}>
          {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </label>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 1 }}>
          Personas per variant
          <small>Stratified across roles and pain levels. 20 personas per API call.</small>
          <select value={s.sampleSize} onChange={set('sampleSize')}>
            {[25, 50, 100, 250, 500].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1 }}>
          Parallel calls
          <small>Lower this if you hit rate limits.</small>
          <select value={s.concurrency} onChange={set('concurrency')}>
            {[1, 2, 3, 5, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <p className="note">A three-variant run at 100 personas is 15 API calls. At 500 personas it's 75.</p>
    </Dialog>
  );
}

const NEW_VARIANT = (i) => ({ id: String.fromCharCode(65 + i), name: `Variant ${String.fromCharCode(65 + i)}`, headline: '', message: '', focus: '' });

export function CampaignDialog({ campaign, live, onSave, onClose }) {
  const [c, setC] = useState(() => JSON.parse(JSON.stringify(campaign)));
  const setV = (i, k) => (e) => {
    const variants = [...c.variants];
    variants[i] = { ...variants[i], [k]: e.target.value };
    setC({ ...c, variants });
  };
  const valid = c.variants.length >= 1 && c.variants.every((v) => v.message.trim());
  const save = (run) => onSave({
    ...c,
    variants: c.variants.map((v, i) => ({ ...v, id: String.fromCharCode(65 + i), name: v.name || `Variant ${String.fromCharCode(65 + i)}` })),
  }, run);

  return (
    <Dialog
      title="Edit campaign"
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Cancel</button>
        {live
          ? <button className="btn primary" disabled={!valid} onClick={() => save(true)}>Save and run simulation</button>
          : <button className="btn primary" disabled={!valid} onClick={() => save(false)}>Save (add an API key to run)</button>}
      </>}
    >
      <label className="field">
        Campaign name
        <input type="text" value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
      </label>
      <label className="field">
        What you sell
        <small>Personas read every message with this in mind, the way a buyer already knows roughly what a vendor does.</small>
        <textarea rows={3} value={c.product} onChange={(e) => setC({ ...c, product: e.target.value })} />
      </label>
      {c.variants.map((v, i) => (
        <div className="variant-edit" key={i} style={variantVars(i)}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <b style={{ color: 'var(--vc)' }}>{v.name || `Variant ${String.fromCharCode(65 + i)}`}</b>
            {c.variants.length > 1 && (
              <button className="toggle-link" onClick={() => setC({ ...c, variants: c.variants.filter((_, j) => j !== i) })}>Remove</button>
            )}
          </div>
          <input type="text" value={v.headline} onChange={setV(i, 'headline')} placeholder="Headline" aria-label="Headline" />
          <textarea rows={3} value={v.message} onChange={setV(i, 'message')} placeholder="The full message personas will read" aria-label="Message" />
          <input type="text" value={v.focus} onChange={setV(i, 'focus')} placeholder="Angle, for your reference (e.g. cost reduction)" aria-label="Angle" />
        </div>
      ))}
      {c.variants.length < 4 && (
        <button className="btn" onClick={() => setC({ ...c, variants: [...c.variants, NEW_VARIANT(c.variants.length)] })}>Add a variant</button>
      )}
      <p className="note">Every variant runs against the same persona sample, so the comparison is fair.</p>
    </Dialog>
  );
}
