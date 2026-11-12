import { monteCarlo, bySegment, PAIN_ORDER, mean, VETO } from './stats.js';

export const SPLIT_SPREAD = 20; // points between best and worst role, within one variant
export const SEGMENT_LOSS = 10; // points the overall winner trails another variant in one segment

function sizeOrder(personas) {
  const bands = [...new Set(personas.map((p) => p.size_band))];
  const lo = (b) => Number(String(b).split('-')[0].replace(/,/g, '')) || 0;
  return bands.sort((a, b) => lo(a) - lo(b));
}

function segmentOrder(market) {
  if (market.segments?.length) return market.segments.map((s) => s.label);
  const counts = {};
  for (const p of market.personas) counts[p.industry] = (counts[p.industry] ?? 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
}

function typeOrder(market) {
  const order = segmentOrder(market);
  const types = [...new Set(market.personas.map((p) => p.company_type).filter(Boolean))];
  const seg = Object.fromEntries(market.personas.map((p) => [p.company_type, order.indexOf(p.industry)]));
  return types.sort((a, b) => seg[a] - seg[b] || a.localeCompare(b));
}

export function analyze(market, variants, results) {
  const personasById = Object.fromEntries(market.personas.map((p) => [p.id, p]));
  const roleLabel = Object.fromEntries(market.roles.map((r) => [r.key, r.label]));
  const live = variants.filter((v) => results[v.id]?.length);

  const perVariant = live.map((v, i) => {
    const rows = results[v.id];
    const mc = monteCarlo(rows, { seed: 11 + i });
    const roles = bySegment(rows, personasById, 'role', market.roles.map((r) => r.key));
    const spread = roles.length ? Math.max(...roles.map((r) => r.mean)) - Math.min(...roles.map((r) => r.mean)) : 0;
    return { variant: v, index: variants.indexOf(v), rows, mc, spread, split: spread >= SPLIT_SPREAD };
  });
  if (!perVariant.length) return null;

  const groups = [
    { key: 'role', label: 'Role', order: market.roles.map((r) => r.key), name: (k) => roleLabel[k] ?? k },
    { key: 'industry', label: 'Segment', order: segmentOrder(market), name: (k) => k },
    { key: 'pain_level', label: 'Pain level', order: PAIN_ORDER, name: (k) => `${k} pain` },
    { key: 'company_type', label: 'Company type', order: typeOrder(market), name: (k) => k, collapsible: true },
    { key: 'size_band', label: 'Company size', order: sizeOrder(market.personas), name: (k) => `${k} employees`, collapsible: true },
  ];

  const ranked = [...perVariant].sort((a, b) => b.mc.pAbove - a.mc.pAbove || b.mc.mean - a.mc.mean);
  const winner = ranked[0];
  const runnerUp = ranked[1];

  const matrix = groups.map((g) => {
    const cols = perVariant.map((pv) => Object.fromEntries(bySegment(pv.rows, personasById, g.key, g.order).map((s) => [s.key, s])));
    const keys = g.order.filter((k) => cols.some((c) => c[k]));
    const rows = keys.map((k) => {
      const cells = cols.map((c) => c[k] ?? null);
      const wi = perVariant.indexOf(winner);
      const best = Math.max(...cells.filter(Boolean).map((c) => c.mean));
      const winnerCell = cells[wi];
      const loss = winnerCell && perVariant.length > 1 ? best - winnerCell.mean : 0;
      const bestIdx = cells.findIndex((c) => c && c.mean === best);
      return { key: k, name: g.name(k), cells, loss, bestIdx, flagWinner: loss >= SEGMENT_LOSS };
    });
    return { ...g, rows };
  });

  // Recommendation: by probability of strong interest, with veto-segment caveats.
  const roleRows = matrix[0].rows;
  const vetoLosses = roleRows
    .filter((r) => VETO.has(r.key) && r.flagWinner)
    .map((r) => ({ role: r.name, by: Math.round(r.loss), to: perVariant[r.bestIdx].variant.name }));
  const overlap = runnerUp && runnerUp.mc.pAboveCI[1] >= winner.mc.pAboveCI[0];

  return { personasById, roleLabel, perVariant, matrix, winner, runnerUp, vetoLosses, overlap };
}

/** Four representative quotes for one variant, spread across the pain spectrum, with one detractor. */
export function pickQuotes(rows, personasById) {
  const enriched = rows.map((r) => ({ ...r, p: personasById[r.persona_id] })).filter((r) => r.p && r.reaction);
  const used = new Set();
  const usedRoles = new Set();
  const take = (list) => {
    const fresh = list.find((r) => !used.has(r.persona_id) && !usedRoles.has(r.p.role)) ?? list.find((r) => !used.has(r.persona_id));
    if (fresh) { used.add(fresh.persona_id); usedRoles.add(fresh.p.role); }
    return fresh;
  };
  const byLevel = (lvl) => enriched.filter((r) => r.p.pain_level === lvl);
  const medianFirst = (list) => {
    const m = mean(list.map((r) => r.score));
    return [...list].sort((a, b) => Math.abs(a.score - m) - Math.abs(b.score - m));
  };
  return [
    take([...byLevel('High')].sort((a, b) => b.score - a.score)),
    take(medianFirst(byLevel('Medium'))),
    take(medianFirst(byLevel('Low'))),
    take([...enriched].sort((a, b) => a.score - b.score)),
  ].filter(Boolean);
}

export function topObjections(rows, limit = 6) {
  const counts = new Map();
  for (const r of rows) {
    if (r.score >= 70 || !r.objection) continue;
    const k = r.objection.trim().replace(/\.$/, '');
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([text, n]) => ({ text, n }));
}
