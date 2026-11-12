// Monte Carlo and segment math. No dependencies, deterministic given a seed.

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rand) {
  let u = 0;
  while (u === 0) u = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}

const SIGMA = { high: 5, medium: 9, low: 14 };
const clamp = (x) => Math.max(0, Math.min(100, x));

export function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

/**
 * Treat each persona's score as a distribution (score ± sigma by confidence), then simulate many
 * markets by resampling personas with replacement. Returns point estimates with 80% intervals.
 */
export function monteCarlo(rows, { sims = 2000, threshold = 70, seed = 11, bins = 20 } = {}) {
  const n = rows.length;
  if (!n) return null;
  const rand = rng(seed);
  const means = [];
  const shares = [];
  const pooled = [];
  for (let s = 0; s < sims; s++) {
    let sum = 0;
    let above = 0;
    for (let i = 0; i < n; i++) {
      const r = rows[Math.floor(rand() * n)];
      const v = clamp(r.score + normal(rand) * (SIGMA[r.confidence] ?? 9));
      sum += v;
      if (v > threshold) above++;
      if (s < 200) pooled.push(v);
    }
    means.push(sum / n);
    shares.push(above / n);
  }
  means.sort((a, b) => a - b);
  shares.sort((a, b) => a - b);
  pooled.sort((a, b) => a - b);

  const width = 100 / bins;
  const hist = new Array(bins).fill(0);
  for (const v of pooled) hist[Math.min(bins - 1, Math.floor(v / width))]++;
  const scale = n / pooled.length; // express bars as "personas per bin" for this sample size

  return {
    n,
    mean: quantile(means, 0.5),
    meanCI: [quantile(means, 0.1), quantile(means, 0.9)],
    p80: quantile(pooled, 0.8),
    pAbove: quantile(shares, 0.5),
    pAboveCI: [quantile(shares, 0.1), quantile(shares, 0.9)],
    hist: hist.map((c) => c * scale),
    binWidth: width,
  };
}

export const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export const PAIN_ORDER = ['High', 'Medium', 'Low'];

/** Group result rows by a persona attribute. Returns [{key, label, n, mean, scores}] */
export function bySegment(rows, personasById, attr, order) {
  const groups = new Map();
  for (const r of rows) {
    const p = personasById[r.persona_id];
    if (!p) continue;
    const k = p[attr];
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r.score);
  }
  const keys = order ? order.filter((k) => groups.has(k)) : [...groups.keys()].sort();
  return keys.map((k) => ({ key: k, n: groups.get(k).length, mean: mean(groups.get(k)), scores: groups.get(k) }));
}

// Which roles can block a deal, and how much is at stake for each, come from market.json.
export const VETO = new Set();
/** "a", "a and b", "a, b and c" */
export const andList = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export const PLURALS = {}; // role label -> plural for mid-sentence use, from market.json
const STAKES = {};
export function setMarketRoles(roles) {
  VETO.clear();
  for (const r of roles) {
    if (r.veto) VETO.add(r.key);
    STAKES[r.key] = r.stakes ?? 0.5;
    if (r.plural) PLURALS[r.label] = r.plural;
  }
}

/** Pick an evenly spread, stratified sample. When the market has segments, each segment gets an
 * equal share of the sample, split evenly across the roles in that segment. Within a role, picks
 * are spread across pain levels. */
export function stratifiedSample(personas, size, roles, seed = 3, segments = null) {
  const rand = rng(seed);
  const quotas = [];
  if (segments?.length) {
    // Equal share per segment. Within a segment, spread the share evenly across roles; a role with
    // too few personas hands its leftover to the other roles in the segment.
    const perSeg = Math.round(size / segments.length);
    for (const s of segments) {
      const segRoles = roles.filter((r) => s.roles.includes(r.key));
      const cap = Object.fromEntries(segRoles.map((r) => [r.key, personas.filter((p) => p.role === r.key).length]));
      const q = Object.fromEntries(segRoles.map((r) => [r.key, 0]));
      let left = perSeg;
      while (left > 0) {
        const open = segRoles.filter((r) => q[r.key] < cap[r.key]);
        if (!open.length) break;
        for (const r of open) { if (left > 0) { q[r.key]++; left--; } }
      }
      for (const r of segRoles) if (q[r.key]) quotas.push([r, q[r.key]]);
    }
  } else {
    const perRole = Math.max(1, Math.round(size / roles.length));
    for (const r of roles) quotas.push([r, perRole]);
  }
  const out = [];
  for (const [role, perRole] of quotas) {
    const pool = personas.filter((p) => p.role === role.key);
    const byLevel = PAIN_ORDER.map((lvl) => shuffle(pool.filter((p) => p.pain_level === lvl), rand));
    let i = 0;
    const picked = [];
    while (picked.length < Math.min(perRole, pool.length)) {
      const bucket = byLevel[i % byLevel.length];
      if (bucket.length) picked.push(bucket.pop());
      i++;
      if (i > perRole * 6) break;
    }
    out.push(...picked);
  }
  return out;
}

function shuffle(xs, rand) {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}


/** How much a persona feels a theme: the intensity of their strongest pain tagged with it, else 0. */
export const themeIntensity = (p, theme) =>
  Math.max(0, ...p.pains.filter((x) => x.tags.includes(theme)).map((x) => x.intensity));

/** Toughest critics for a claim that leans on one theme. Max two per role. */
export function toughestCritics(personas, theme, count = 5) {
  const ranked = [...personas]
    .map((p) => ({
      p,
      t: p.skepticism * 0.5 + (1 - themeIntensity(p, theme)) * 0.3 + (STAKES[p.role] ?? 0.5) * 0.2,
    }))
    .sort((a, b) => b.t - a.t);
  const perRole = {};
  const out = [];
  for (const { p } of ranked) {
    if ((perRole[p.role] ?? 0) >= 2) continue;
    perRole[p.role] = (perRole[p.role] ?? 0) + 1;
    out.push(p);
    if (out.length === count) break;
  }
  return out;
}
