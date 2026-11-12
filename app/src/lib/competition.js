// Head-to-head scoring against competitors, feature by feature.
//
// Every message for a feature (ours and each competitor's) is read by the same personas, blind,
// so differences are paired: the same CFO read both. That makes a paired bootstrap the right
// test, and it's much tighter than comparing two independent averages.

import { rng, quantile, mean, VETO } from './stats.js';

export const OURS = 'ours';
export const LEAD = 3; // points: smaller gaps are a tie even if the interval clears zero
export const ROLE_GAP = 5; // points: smallest role-level gap worth calling out
export const VETO_PULL = 8; // points: a competitor pulling a blocking role this far ahead of us
const SIGMA = { high: 5, medium: 9, low: 14 };

/** Paired bootstrap of (theirs − ours) over the personas who read both. */
export function pairedDiff(ours, theirs, keep = () => true, { sims = 2000, seed = 5 } = {}) {
  const byId = new Map(ours.map((r) => [r.persona_id, r]));
  const pairs = theirs
    .filter((t) => byId.has(t.persona_id) && keep(t.persona_id))
    .map((t) => {
      const o = byId.get(t.persona_id);
      const sd = Math.sqrt((SIGMA[o.confidence] ?? 9) ** 2 + (SIGMA[t.confidence] ?? 9) ** 2);
      return { d: t.score - o.score, sd };
    });
  const n = pairs.length;
  if (!n) return null;
  const rand = rng(seed);
  const normal = () => {
    let u = 0;
    while (u === 0) u = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
  };
  const means = [];
  for (let s = 0; s < sims; s++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const p = pairs[Math.floor(rand() * n)];
      sum += p.d + normal() * p.sd; // each score is a distribution, as in monteCarlo()
    }
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  return { n, mean: mean(pairs.map((p) => p.d)), ci: [quantile(means, 0.1), quantile(means, 0.9)] };
}

/** From our side: 'win' if we lead, 'loss' if they lead, 'tie' if the gap is small or uncertain. */
export function verdict(diff) {
  if (!diff) return null;
  const [lo, hi] = diff.ci;
  if (Math.abs(diff.mean) < LEAD || (lo <= 0 && hi >= 0)) return 'tie';
  return diff.mean > 0 ? 'loss' : 'win';
}

const roleMeans = (rows, personasById) => {
  const g = {};
  for (const r of rows) {
    const p = personasById[r.persona_id];
    if (p) (g[p.role] ??= []).push(r.score);
  }
  return Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.length, mean: mean(v) }]));
};

export function brandList(comp, ourName) {
  return [
    { id: OURS, name: ourName, index: 0 },
    ...comp.competitors.map((c, i) => ({ ...c, index: i + 1 })),
  ];
}

export function analyzeCompetition(market, brief, comp) {
  if (!comp || !brief) return null;
  const personasById = Object.fromEntries(market.personas.map((p) => [p.id, p]));
  const roleLabel = Object.fromEntries(market.roles.map((r) => [r.key, r.label]));
  const ourName = (brief.product_name ?? 'Us').split(' ')[0];
  const brands = brandList(comp, ourName);
  const featById = Object.fromEntries((brief.features ?? []).map((f) => [f.id, f]));

  const features = comp.features.filter((fid) => featById[fid]).map((fid) => {
    const f = featById[fid];
    const res = comp.results?.[fid] ?? {};
    const main = new Set(f.primary_roles?.length ? f.primary_roles : market.roles.map((r) => r.key));
    const isMain = (pid) => main.has(personasById[pid]?.role);
    const cells = Object.fromEntries(brands.map((b) => {
      const rows = res[b.id] ?? [];
      const hasMessage = Boolean(comp.messages?.[fid]?.[b.id]?.trim());
      if (!rows.length) return [b.id, { hasMessage, scored: false }];
      const mainRows = rows.filter((r) => isMain(r.persona_id));
      return [b.id, {
        hasMessage,
        scored: true,
        rows,
        main: mean(mainRows.map((r) => r.score)),
        all: mean(rows.map((r) => r.score)),
        above: mainRows.filter((r) => r.score > 70).length / (mainRows.length || 1),
        nMain: mainRows.length,
        roles: roleMeans(rows, personasById),
      }];
    }));

    const ours = cells[OURS];
    const h2h = {};
    for (const b of brands.slice(1)) {
      const them = cells[b.id];
      if (!ours?.scored || !them?.scored) continue;
      const diffMain = pairedDiff(ours.rows, them.rows, isMain, { seed: 5 + b.index });
      const diffAll = pairedDiff(ours.rows, them.rows, () => true, { seed: 9 + b.index });
      const roleDiffs = market.roles
        .filter((r) => ours.roles[r.key] && them.roles[r.key])
        .map((r) => ({ key: r.key, label: r.label, main: main.has(r.key), d: them.roles[r.key].mean - ours.roles[r.key].mean }));
      h2h[b.id] = { diffMain, diffAll, verdict: verdict(diffMain), verdictAll: verdict(diffAll), roleDiffs };
    }
    const contested = brands.slice(1).some((b) => cells[b.id]?.hasMessage);
    return { f, main: [...main], cells, h2h, contested };
  });

  // Each competitor's record, from our side, on the main personas.
  const record = Object.fromEntries(brands.slice(1).map((b) => {
    const vs = features.map((x) => x.h2h[b.id]?.verdict).filter(Boolean);
    return [b.id, { win: vs.filter((v) => v === 'win').length, tie: vs.filter((v) => v === 'tie').length, loss: vs.filter((v) => v === 'loss').length }];
  }));

  return { personasById, roleLabel, brands, features, record, ourName, findings: findings(features, brands, roleLabel) };
}

const plural = (label) => {
  const first = label.split(' ')[0];
  const base = first === first.toUpperCase() ? label : label[0].toLowerCase() + label.slice(1);
  return `${base}s`;
};
const r0 = Math.round;
/** Lowercase a feature name for mid-sentence use, but leave acronyms like OSHA alone. */
const lc = (s) => (s && s[1] && s[1] === s[1].toLowerCase() ? s[0].toLowerCase() + s.slice(1) : s);
const fname = (f) => f.short || f.name;

function findings(features, brands, roleLabel) {
  const out = [];
  const name = (id) => brands.find((b) => b.id === id)?.name;
  const mainNames = (x) => x.main.map((k) => plural(roleLabel[k] ?? k)).join(' and ');

  const losses = [];
  const vetoes = [];
  const splits = [];
  const ties = [];
  const wins = [];
  for (const x of features) {
    for (const [bid, h] of Object.entries(x.h2h)) {
      const gap = h.diffMain?.mean ?? 0;
      if (h.verdict === 'loss') losses.push({ x, bid, gap });
      if (h.verdict === 'tie') ties.push({ x, bid, gap });
      if (h.verdict === 'win') wins.push({ x, bid, gap });
      const veto = h.roleDiffs.filter((r) => !r.main && VETO.has(r.key) && r.d >= VETO_PULL).sort((a, b) => b.d - a.d)[0];
      if (veto) vetoes.push({ x, bid, r: veto });
      const theirBest = [...h.roleDiffs].sort((a, b) => b.d - a.d)[0];
      const ourBest = [...h.roleDiffs].sort((a, b) => a.d - b.d)[0];
      if (!veto && h.verdict !== 'loss' && theirBest && ourBest && theirBest.d >= ROLE_GAP && ourBest.d <= -ROLE_GAP && (theirBest.main || ourBest.main)) {
        splits.push({ x, bid, theirBest, ourBest });
      }
    }
  }

  for (const { x, bid, gap } of losses.sort((a, b) => b.gap - a.gap)) {
    out.push({ kind: 'loss', text: `${name(bid)} beats our ${lc(fname(x.f))} message with ${mainNames(x)} by ${r0(gap)} points. Their copy is doing something ours isn't.` });
  }
  for (const { x, bid, r } of vetoes.sort((a, b) => b.r.d - a.r.d)) {
    out.push({ kind: 'veto', text: `${name(bid)}'s ${lc(fname(x.f))} message pulls ${plural(r.label)} ${r0(r.d)} points higher than ours. It isn't built for them, but they can block the deal.` });
  }
  for (const { x, bid, theirBest, ourBest } of splits) {
    out.push({ kind: 'split', text: `On ${lc(fname(x.f))}, ${name(bid)} and we split the buying group: they win ${plural(theirBest.label)} by ${r0(theirBest.d)}, we win ${plural(ourBest.label)} by ${r0(-ourBest.d)}. Don't let the average hide it.` });
  }
  for (const { x, bid } of ties.filter((t) => !splits.some((s) => s.x === t.x && s.bid === t.bid)).slice(0, 2)) {
    out.push({ kind: 'tie', text: `On ${lc(fname(x.f))}, it's a tie with ${name(bid)}. Nothing in either message sets it apart for ${mainNames(x)}.` });
  }
  const best = wins.sort((a, b) => a.gap - b.gap)[0];
  if (best) out.push({ kind: 'win', text: `Our clearest lead: ${lc(fname(best.x.f))}, ${r0(-best.gap)} points ahead of ${name(best.bid)} with ${mainNames(best.x)}.` });
  for (const x of features.filter((f) => !f.contested)) {
    out.push({ kind: 'open', text: `No competitor messages ${lc(fname(x.f))}. That's open ground worth claiming loudly.` });
  }
  return out;
}

/** Same persona, both messages: two where they beat us most, two where we beat them most. */
export function pairedQuotes(ours, theirs, personasById, mainRoles) {
  const byId = new Map(ours.map((r) => [r.persona_id, r]));
  const pairs = theirs
    .filter((t) => byId.has(t.persona_id) && personasById[t.persona_id])
    .map((t) => ({ p: personasById[t.persona_id], ours: byId.get(t.persona_id), theirs: t, d: t.score - byId.get(t.persona_id).score }));
  const usedRoles = new Set();
  const pick = (list) => {
    const main = list.filter((x) => mainRoles.includes(x.p.role));
    const hit = [...main, ...list].find((x) => !usedRoles.has(`${x.p.role}:${x.d > 0}`));
    if (hit) usedRoles.add(`${hit.p.role}:${hit.d > 0}`);
    return hit;
  };
  const theyWin = pairs.filter((x) => x.d > 0).sort((a, b) => b.d - a.d);
  const weWin = pairs.filter((x) => x.d < 0).sort((a, b) => a.d - b.d);
  const out = [];
  for (let i = 0; i < 2; i++) {
    const a = pick(theyWin.filter((x) => !out.includes(x)));
    if (a) out.push(a);
  }
  for (let i = 0; i < 2; i++) {
    const b = pick(weWin.filter((x) => !out.includes(x)));
    if (b) out.push(b);
  }
  return out;
}

/** Hide brand names so personas judge the copy, not the logo. */
export function anonymize(text, names) {
  let out = text;
  const words = [...new Set(names.flatMap((n) => [n, n.split(' ')[0]]).filter((n) => n && n.length > 2))]
    .sort((a, b) => b.length - a.length);
  for (const w of words) {
    out = out.replace(new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}('s)?\\b`, 'gi'), (_m, s) => (s ? "the vendor's" : 'the vendor'));
  }
  return out.replace(/(^|[.!?]\s+)the vendor/g, (_m, pre) => `${pre}The vendor`);
}

/** API calls for a run: every message for every feature, in batches of 20 personas. */
export function runCost(comp, sampleSize) {
  const batches = Math.ceil(sampleSize / 20);
  let messages = 0;
  for (const fid of comp.features) {
    for (const v of Object.values(comp.messages?.[fid] ?? {})) if (v?.trim()) messages++;
  }
  return { messages, calls: messages * batches };
}

export function competitionToCsv(comp, brands, features, personasById) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['feature', 'brand', 'persona_id', 'role', 'industry', 'size_band', 'pain_level', 'score', 'confidence', 'reaction', 'objection'].join(',')];
  for (const x of features) {
    for (const b of brands) {
      for (const r of comp.results?.[x.f.id]?.[b.id] ?? []) {
        const p = personasById[r.persona_id] ?? {};
        lines.push([x.f.name, b.name, r.persona_id, p.role_label, p.industry, p.size_band, p.pain_level, r.score, r.confidence, r.reaction, r.objection].map(esc).join(','));
      }
    }
  }
  return lines.join('\n');
}
