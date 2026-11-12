import React, { useRef, useState } from 'react';
import { Dialog, Icon, variantVars } from './ui.jsx';
import { ACCEPT, DOC_TYPES } from '../lib/docs.js';

function ProofPips({ n }) {
  const label = ['', 'No proof', 'Anecdote', 'Pilot', 'Measured', 'Independent'][n] ?? '';
  return (
    <span className="proof" title={`Proof strength ${n} of 5: ${label}`}>
      <span className="severity" aria-hidden="true">{[1, 2, 3, 4, 5].map((i) => <i key={i} className={i <= n ? `on p${n}` : ''} />)}</span>
      <span className={`proof-label p${n}`}>{label}</span>
    </span>
  );
}

function DropZone({ onFiles, disabled }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? 'over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); }}
    >
      <Icon name="upload" className="dz-icon" />
      <p><b>Drop your PRDs, MRDs and creative briefs here</b></p>
      <p className="note">PDF, Word, Markdown or plain text, up to 20 MB each. Add as many as the launch has.</p>
      <button className="btn" onClick={() => ref.current?.click()} disabled={disabled}>Choose files</button>
      <input id="doc-files" ref={ref} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { if (e.target.files.length) onFiles([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
}

function PasteForm({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('PRD');
  const [text, setText] = useState('');
  return (
    <div className="panel composer">
      <div className="row">
        <label className="field" style={{ flex: 2, minWidth: 180 }}>Name<input id="paste-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q2 launch PRD" /></label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>Type
          <select id="paste-type" value={type} onChange={(e) => setType(e.target.value)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
      </div>
      <label className="field">Text<textarea id="paste-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste from a Google Doc, Notion page or email" /></label>
      <div className="row">
        <button className="btn primary" disabled={!text.trim()} onClick={() => { onAdd(name, text, type); onClose(); }}>Add document</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

export default function DocumentsView({
  market, docs, sampleDocs, brief, campaign, live, busy, hasResults,
  onFiles, onPaste, onRemove, onSetType, onAnalyze, onRewrite, onGo, onStressClaim, onPreview,
}) {
  const [pasting, setPasting] = useState(false);
  const [preview, setPreview] = useState(null);
  const roleLabel = Object.fromEntries(market.roles.map((r) => [r.key, r.label]));
  const weakest = brief?.claims?.length ? [...brief.claims].sort((a, b) => a.proof_strength - b.proof_strength)[0] : null;
  const generated = campaign.variants.some((v) => v.rationale);

  const openPreview = async (d) => {
    const text = d.text ?? (await onPreview?.(d));
    setPreview({ ...d, text: text ?? 'This PDF goes to Claude as-is, so there is no text preview here.' });
  };

  return (
    <>
      <div className="docs-top">
        <div className="docs-left">
          <DropZone onFiles={onFiles} disabled={busy} />
          {pasting
            ? <PasteForm onAdd={onPaste} onClose={() => setPasting(false)} />
            : <button className="toggle-link" onClick={() => setPasting(true)}>Paste text instead</button>}
        </div>

        <div className="panel docs-list">
          <div className="section-head">
            <h2>{sampleDocs ? 'Meshy launch documents' : 'Your documents'}</h2>
            <p>{docs.length} {docs.length === 1 ? 'file' : 'files'}</p>
          </div>
          {docs.length === 0 && <p className="empty">No documents yet. Add a PRD to get features, an MRD for claims and proof, and a creative brief for tone and mandatories.</p>}
          {docs.map((d) => (
            <div className="doc-row" key={d.id}>
              <span className="doc-icon" aria-hidden="true">{d.kind === 'PDF' ? 'PDF' : d.kind === 'Word' ? 'DOC' : 'TXT'}</span>
              <div className="doc-meta">
                <button className="doc-name" onClick={() => openPreview(d)} title="Preview">{d.name}</button>
                <span className="note">{d.kind}{d.words ? `, ${d.words.toLocaleString()} words` : d.size ? `, ${(d.size / 1024).toFixed(0)} KB` : ''}{sampleDocs ? ', preloaded' : ''}</span>
              </div>
              <select value={d.type} onChange={(e) => onSetType(d.id, e.target.value)} aria-label={`Type of ${d.name}`} disabled={sampleDocs}>
                {DOC_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              {!sampleDocs && <button className="btn ghost small" onClick={() => onRemove(d.id)} aria-label={`Remove ${d.name}`}><Icon name="close" /></button>}
            </div>
          ))}
          <div className="docs-action">
            <button className="btn primary" disabled={busy || !docs.length || sampleDocs && !live} onClick={onAnalyze}>
              <Icon name="play" />{live ? 'Read documents and write messaging' : 'Add an API key to analyze'}
            </button>
            <p className="note">
              {sampleDocs
                ? 'The Meshy MRD and creative brief are preloaded, and the brief below was drawn from them. Click above to have Claude re-read them and write fresh messaging, or upload new versions to replace them.'
                : live ? 'Claude extracts features, claims and guardrails, then writes three message directions. Two API calls.' : 'Add your Claude API key in Settings to analyze these documents.'}
            </p>
          </div>
        </div>
      </div>

      {brief && (
        <>
          <section className="section">
            <div className="section-head">
              <h2>What Claude found</h2>
              <p>From {brief.source_count ?? docs.length} documents. Check it before you trust the simulations built on it.</p>
            </div>
            <div className="brief-grid">
              <div className="panel">
                <h3 className="brief-name">{brief.product_name}</h3>
                <p className="brief-summary">{brief.summary}</p>
                <dl className="brief-dl">
                  <dt>Proposition</dt><dd>{brief.proposition}</dd>
                  <dt>Customer</dt><dd>{brief.target}</dd>
                  <dt>Tone</dt><dd>{brief.tone}</dd>
                </dl>
              </div>
              <div className="panel">
                <h3 className="panel-title">Guardrails from the creative brief</h3>
                {brief.mandatories?.length ? (
                  <ul className="checks">{brief.mandatories.map((m) => <li key={m}>{m}</li>)}</ul>
                ) : <p className="note">No mandatories found. Add a creative brief to give the messaging guardrails.</p>}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Features <span className="count">{brief.features.length}</span></h2>
              <button className="btn small" onClick={() => onGo('adoption')}>See adoption by persona</button>
            </div>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Feature</th><th>Built for</th><th>Setup</th><th>Themes</th><th>Source</th></tr></thead>
                <tbody>
                  {brief.features.map((f) => (
                    <tr key={f.id}>
                      <td><b>{f.name}</b><div className="note">{f.description}</div></td>
                      <td>{f.primary_roles.map((r) => <span key={r} className="chip neutral" style={{ marginRight: 4 }}>{roleLabel[r] ?? r}</span>)}</td>
                      <td><span className={`effort ${f.setup_effort}`}>{f.setup_effort}</span></td>
                      <td className="note">{f.themes.join(', ')}</td>
                      <td className="note">{f.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Claims and proof <span className="count">{brief.claims.length}</span></h2>
              <p>Weak proof is where a skeptical buyer pushes first</p>
            </div>
            <div className="panel claims">
              {[...brief.claims].sort((a, b) => a.proof_strength - b.proof_strength).map((c) => (
                <div className="claim-row" key={c.id}>
                  <div>
                    <b>{c.text}</b>
                    <div className="note">{c.proof} <span className="src">{c.source}</span></div>
                  </div>
                  <ProofPips n={c.proof_strength} />
                  {c === weakest
                    ? <button className="btn small" onClick={() => onStressClaim(c)}>Stress-test this</button>
                    : <span />}
                </div>
              ))}
            </div>
          </section>

          <section className="section">
            <div className="section-head">
              <h2>Messaging to test</h2>
              <div className="row">
                {live && <button className="btn small" disabled={busy} onClick={onRewrite}>Write new directions</button>}
                <button className="btn small primary" onClick={() => onGo('compare')}>{hasResults ? 'See how the market responds' : 'Run the simulation'}</button>
              </div>
            </div>
            {!generated && <p className="note" style={{ marginBottom: 10 }}>These directions were written by hand, not from the documents.</p>}
            <div className="variant-row" style={{ gridTemplateColumns: `repeat(${Math.min(campaign.variants.length, 3)}, 1fr)` }}>
              {campaign.variants.map((v, i) => (
                <article key={v.id} className="variant-card" style={variantVars(i)}>
                  <div className="tag">{v.name}: {v.focus}</div>
                  <h3>{v.headline}</h3>
                  <p className="copy full">{v.message}</p>
                  {v.rationale && <p className="rationale">{v.rationale}</p>}
                  {(v.features?.length > 0 || v.claims?.length > 0) && (
                    <div className="trace">
                      {v.features?.map((id) => {
                        const f = brief.features.find((x) => x.id === id);
                        return f ? <span key={id} className="chip neutral" title={f.description}>{f.short}</span> : null;
                      })}
                      {v.claims?.map((id) => {
                        const c = brief.claims.find((x) => x.id === id);
                        return c ? <span key={id} className={`chip neutral ${c.proof_strength <= 2 ? 'weak' : ''}`} title={`${c.text} Proof: ${c.proof}`}>Claim {id}</span> : null;
                      })}
                    </div>
                  )}
                  {v.checks?.length > 0 && <ul className="checks small">{v.checks.map((c) => <li key={c}>{c}</li>)}</ul>}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {preview && (
        <Dialog title={preview.name} onClose={() => setPreview(null)}>
          <pre className="doc-preview">{preview.text}</pre>
        </Dialog>
      )}
    </>
  );
}
