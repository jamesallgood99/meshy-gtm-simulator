import { callClaude, toolInput, pool, text } from './anthropic.js';
import {
  scoreSystem, scoreUser, SCORE_TOOL, stressSystem, stressUser, STRESS_TOOL, talkSystem,
  extractSystem, EXTRACT_TOOL, docsUserContent, messagesSystem, messagesUser, MESSAGES_TOOL,
  adoptSystem, adoptUser, ADOPT_TOOL,
  competitionProduct, mapCompetitorSystem, mapCompetitorUser, MAP_COMPETITOR_TOOL,
} from './prompts.js';
import { anonymize } from './competition.js';

const BATCH = 20;

/** Score one or more variants against the same persona sample. */
export async function runScore({ settings, market, product, context, variants, sample, onProgress, signal }) {
  const batches = [];
  for (let i = 0; i < sample.length; i += BATCH) batches.push(sample.slice(i, i + BATCH));
  const total = variants.length * batches.length;
  let done = 0;

  const jobs = [];
  for (const v of variants) {
    for (const batch of batches) {
      jobs.push(async () => {
        const res = await callClaude({
          apiKey: settings.apiKey,
          model: settings.model,
          system: scoreSystem(market),
          messages: [{ role: 'user', content: scoreUser({ message: v.message, variantName: v.name, product, context, personas: batch }) }],
          tools: [SCORE_TOOL],
          toolChoice: { type: 'tool', name: SCORE_TOOL.name },
          maxTokens: 6000,
          signal,
        });
        const ids = new Set(batch.map((p) => p.id));
        const rows = (toolInput(res, SCORE_TOOL.name).results ?? [])
          .filter((r) => ids.has(r.persona_id))
          .map((r) => ({ ...r, score: Math.max(0, Math.min(100, Math.round(Number(r.score)))) }));
        return { variant: v.id, rows };
      });
    }
  }
  const out = await pool(jobs, settings.concurrency ?? 3, () => onProgress?.(++done, total));
  const results = Object.fromEntries(variants.map((v) => [v.id, []]));
  for (const { variant, rows } of out) results[variant].push(...rows);
  return results;
}

export async function runStress({ settings, market, product, claim, critics, signal }) {
  const res = await callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    system: stressSystem(market),
    messages: [{ role: 'user', content: stressUser({ claim, product, personas: critics }) }],
    tools: [STRESS_TOOL],
    toolChoice: { type: 'tool', name: STRESS_TOOL.name },
    maxTokens: 4000,
    signal,
  });
  return { claim, ...toolInput(res, STRESS_TOOL.name) };
}

export async function runTalk({ settings, market, product, persona, transcript, signal }) {
  const messages = transcript.map((t) => ({ role: t.role === 'user' ? 'user' : 'assistant', content: t.text }));
  const res = await callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    system: talkSystem(persona, product),
    messages,
    maxTokens: 600,
    signal,
  });
  return text(res);
}

/** Read the uploaded documents and pull out features, claims and creative guardrails. */
export async function runExtract({ settings, market, docs, signal }) {
  const res = await callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    system: extractSystem(market),
    messages: [{ role: 'user', content: docsUserContent(docs) }],
    tools: [EXTRACT_TOOL],
    toolChoice: { type: 'tool', name: EXTRACT_TOOL.name },
    maxTokens: 8000,
    signal,
  });
  const brief = toolInput(res, EXTRACT_TOOL.name);
  const roleKeys = new Set(market.roles.map((r) => r.key));
  brief.features = (brief.features ?? []).map((f, i) => ({
    ...f,
    id: f.id || `F${i + 1}`,
    primary_roles: (f.primary_roles ?? []).filter((r) => roleKeys.has(r)),
    themes: f.themes ?? [],
  }));
  brief.claims = (brief.claims ?? []).map((c, i) => ({ ...c, id: c.id || `K${i + 1}` }));
  return brief;
}

/** Write message directions from the brief. Returns campaign variants. */
export async function runMessages({ settings, market, brief, count = 3, signal }) {
  const res = await callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    system: messagesSystem(market),
    messages: [{ role: 'user', content: messagesUser(brief, count) }],
    tools: [MESSAGES_TOOL],
    toolChoice: { type: 'tool', name: MESSAGES_TOOL.name },
    maxTokens: 3000,
    signal,
  });
  return (toolInput(res, MESSAGES_TOOL.name).variants ?? []).slice(0, 4).map((v, i) => ({
    ...v,
    id: String.fromCharCode(65 + i),
    name: `Variant ${String.fromCharCode(65 + i)}`,
  }));
}

const ADOPT_BATCH = 5;

/** Every persona in the sample against every feature. */
export async function runAdoption({ settings, product, features, sample, market, onProgress, signal }) {
  const batches = [];
  for (let i = 0; i < sample.length; i += ADOPT_BATCH) batches.push(sample.slice(i, i + ADOPT_BATCH));
  let done = 0;
  const fids = new Set(features.map((f) => f.id));
  const clamp = (x) => Math.max(0, Math.min(100, Math.round(Number(x))));
  const jobs = batches.map((batch) => async () => {
    const res = await callClaude({
      apiKey: settings.apiKey,
      model: settings.model,
      system: adoptSystem(market),
      messages: [{ role: 'user', content: adoptUser({ product, features, personas: batch }) }],
      tools: [ADOPT_TOOL],
      toolChoice: { type: 'tool', name: ADOPT_TOOL.name },
      maxTokens: 8000,
      signal,
    });
    const ids = new Set(batch.map((p) => p.id));
    return (toolInput(res, ADOPT_TOOL.name).rows ?? [])
      .filter((r) => ids.has(r.persona_id) && fids.has(r.feature_id))
      .map((r) => ({ ...r, enthusiasm: clamp(r.enthusiasm), adopt_90d: clamp(r.adopt_90d), adopt_12m: clamp(r.adopt_12m) }));
  });
  const out = await pool(jobs, settings.concurrency ?? 3, () => onProgress?.(++done, batches.length));
  return { sample_ids: sample.map((p) => p.id), rows: out.flat() };
}

/**
 * Competition: score our message and every competitor's message for each feature, blind, against
 * one shared persona sample. Returns results keyed by feature, then brand.
 */
export async function runCompetition({ settings, market, brief, comp, sample, onProgress, signal }) {
  const names = [brief.product_name, ...comp.competitors.map((c) => c.name)].filter(Boolean);
  const variants = [];
  for (const fid of comp.features) {
    const f = brief.features.find((x) => x.id === fid);
    if (!f) continue;
    for (const [brand, msg] of Object.entries(comp.messages?.[fid] ?? {})) {
      if (!msg?.trim()) continue;
      variants.push({ id: `${fid}::${brand}`, name: '', message: anonymize(msg, names), feature: f });
    }
  }
  // One runScore call per feature keeps the product context right; progress spans the whole run.
  const batches = Math.ceil(sample.length / 20);
  const total = variants.length * batches;
  let done = 0;
  const results = {};
  for (const fid of comp.features) {
    const vs = variants.filter((v) => v.feature.id === fid);
    if (!vs.length) continue;
    const base = done;
    const res = await runScore({
      settings, market, context: competitionProduct(vs[0].feature), variants: vs, sample, signal,
      onProgress: (d) => { done = base + d; onProgress?.(done, total); },
    });
    results[fid] = Object.fromEntries(Object.entries(res).map(([id, rows]) => [id.split('::')[1], rows]));
  }
  return { sample_ids: sample.map((p) => p.id), results };
}

/** Read a competitor's own copy and map it to our features. */
export async function runMapCompetitor({ settings, market, name, text, features, signal }) {
  const res = await callClaude({
    apiKey: settings.apiKey,
    model: settings.model,
    system: mapCompetitorSystem(market),
    messages: [{ role: 'user', content: mapCompetitorUser({ name, text, features }) }],
    tools: [MAP_COMPETITOR_TOOL],
    toolChoice: { type: 'tool', name: MAP_COMPETITOR_TOOL.name },
    maxTokens: 3000,
    signal,
  });
  const out = toolInput(res, MAP_COMPETITOR_TOOL.name);
  const ids = new Set(features.map((f) => f.id));
  return {
    positioning: out.positioning ?? '',
    messages: Object.fromEntries((out.messages ?? []).filter((m) => ids.has(m.feature_id) && m.message?.trim()).map((m) => [m.feature_id, m.message.trim()])),
  };
}

// ---- CSV import/export so runs from the Claude skill and the dashboard are interchangeable ----

const COLS = ['persona_id', 'role', 'industry', 'size_band', 'pain_level', 'variant', 'score', 'confidence', 'reaction', 'objection'];

export function resultsToCsv(results, personasById) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [COLS.join(',')];
  for (const [variant, rows] of Object.entries(results)) {
    for (const r of rows) {
      const p = personasById[r.persona_id] ?? {};
      lines.push([r.persona_id, p.role_label, p.industry, p.size_band, p.pain_level, variant, r.score, r.confidence, r.reaction, r.objection].map(esc).join(','));
    }
  }
  return lines.join('\n');
}

export function parseCsv(textIn) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < textIn.length; i++) {
    const c = textIn[i];
    if (quoted) {
      if (c === '"' && textIn[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && textIn[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  const idx = Object.fromEntries(head.map((h, i) => [h.trim().toLowerCase(), i]));
  for (const need of ['persona_id', 'variant', 'score']) {
    if (!(need in idx)) throw new Error(`The CSV needs a "${need}" column.`);
  }
  const results = {};
  for (const r of body) {
    const v = r[idx.variant].trim();
    (results[v] ??= []).push({
      persona_id: r[idx.persona_id].trim(),
      score: Math.round(Number(r[idx.score])),
      confidence: (r[idx.confidence] ?? 'medium').trim() || 'medium',
      reaction: r[idx.reaction] ?? '',
      objection: r[idx.objection] ?? '',
    });
  }
  return results;
}
