// Channels: where each persona is most receptive to one message. Every persona in a sample rates
// the same message delivered through each channel, so channels are compared persona by persona.

import { mean, VETO, PLURALS, andList } from './stats.js';

export const CHANNELS = [
  { id: 'paid_social', label: 'Paid social', short: 'Social', detail: 'Meta, Instagram, TikTok ads in the feed' },
  { id: 'linkedin', label: 'LinkedIn', short: 'LinkedIn', detail: 'Sponsored posts, InMail and job-title targeting' },
  { id: 'search', label: 'Search ads', short: 'Search', detail: 'Google and Bing ads on intent searches' },
  { id: 'video', label: 'YouTube and video', short: 'Video', detail: 'Pre-roll, sponsored tutorials, short video' },
  { id: 'email', label: 'Email', short: 'Email', detail: 'Personalized outbound and nurture email' },
  { id: 'newsletter', label: 'Newsletters and trade press', short: 'Press', detail: '80 Level, Game Developer, GamesIndustry.biz, All3DP' },
  { id: 'boards', label: 'Message boards and communities', short: 'Boards', detail: 'Reddit, Discord, Polycount, MakerWorld forums' },
  { id: 'creators', label: 'Creators and tutorials', short: 'Creators', detail: 'YouTubers, devlog creators, print-farm channels' },
  { id: 'events', label: 'Events and conferences', short: 'Events', detail: 'GDC, Develop, Unreal Fest, RAPID + TCT, Maker Faire' },
  { id: 'podcasts', label: 'Podcasts', short: 'Podcasts', detail: 'Game-dev, 3D and industry podcasts' },
  { id: 'ooh', label: 'Billboards and out-of-home', short: 'Billboards', detail: 'Billboards, transit and venue signage' },
  { id: 'tv', label: 'TV and connected TV', short: 'TV', detail: 'Broadcast, streaming and connected-TV spots' },
];

export const CHANNEL_IDS = CHANNELS.map((c) => c.id);
const label = Object.fromEntries(CHANNELS.map((c) => [c.id, c.label]));
const lc = (s) => s.replace(/^(?!TV|LinkedIn|YouTube)./, (c) => c.toLowerCase());

/** Mean receptivity per role (and per segment, and overall) per channel. */
export function aggregateChannels(market, rows) {
  const personasById = Object.fromEntries(market.personas.map((p) => [p.id, p]));
  const cell = { role: {}, segment: {}, all: {} };
  for (const r of rows) {
    const p = personasById[r.persona_id];
    if (!p) continue;
    for (const [k, key] of [['role', p.role], ['segment', p.industry], ['all', 'all']]) {
      ((cell[k][key] ??= {})[r.channel_id] ??= []).push(r);
    }
  }
  const stat = (rs) => (rs?.length ? { n: rs.length, mean: mean(rs.map((x) => x.receptivity)), rows: rs } : null);
  const out = {};
  for (const [k, groups] of Object.entries(cell)) {
    out[k] = {};
    for (const [g, chans] of Object.entries(groups)) {
      out[k][g] = Object.fromEntries(CHANNEL_IDS.map((c) => [c, stat(chans[c])]));
    }
  }
  return { ...out, personasById };
}

/** Channels for one group, best first. */
export function ranked(groupStats) {
  return CHANNEL_IDS.map((c) => ({ c, s: groupStats?.[c] })).filter((x) => x.s).sort((a, b) => b.s.mean - a.s.mean);
}

export function channelFindings(market, agg) {
  const out = [];
  const segs = market.segments?.map((s) => s.label) ?? Object.keys(agg.segment);
  const roleLabel = Object.fromEntries(market.roles.map((r) => [r.key, r.label]));
  const plural = (k) => PLURALS[roleLabel[k]] ?? `${roleLabel[k]}s`;

  for (const seg of segs) {
    const top = ranked(agg.segment[seg]).slice(0, 2);
    if (top.length) {
      out.push({ kind: 'pull', text: `${seg} are best reached through ${lc(label[top[0].c])} (${Math.round(top[0].s.mean)}), then ${lc(label[top[1].c])} (${Math.round(top[1].s.mean)}).` });
    }
  }

  // The roles that can block a deal: where can this message reach them at all?
  const vetoRoles = market.roles.filter((r) => VETO.has(r.key) && agg.role[r.key]);
  const hardest = vetoRoles
    .map((r) => ({ r, best: ranked(agg.role[r.key])[0] }))
    .filter((x) => x.best)
    .sort((a, b) => a.best.s.mean - b.best.s.mean)[0];
  if (hardest) {
    out.push({ kind: 'split', text: `${plural(hardest.r.key).replace(/^./, (c) => c.toUpperCase())} are the hardest blockers to reach: even their best channel, ${lc(label[hardest.best.c])}, only gets ${Math.round(hardest.best.s.mean)}.` });
  }

  // A channel that wins a champion and loses a blocker in the same segment.
  let split = null;
  for (const seg of market.segments ?? []) {
    const champs = seg.roles.filter((k) => !VETO.has(k) && agg.role[k]);
    const blockers = seg.roles.filter((k) => VETO.has(k) && agg.role[k]);
    for (const c of CHANNEL_IDS) {
      for (const a of champs) for (const b of blockers) {
        const gap = (agg.role[a][c]?.mean ?? 0) - (agg.role[b][c]?.mean ?? 0);
        if (!split || gap > split.gap) split = { c, a, b, gap };
      }
    }
  }
  if (split && split.gap >= 25) {
    out.push({ kind: 'fade', text: `${label[split.c]} splits the buying group: ${plural(split.a)} ${Math.round(agg.role[split.a][split.c].mean)}, ${plural(split.b)} ${Math.round(agg.role[split.b][split.c].mean)}. ${roleLabel[split.b]} can block the deal, so pair it with a channel that reaches them.` });
  }

  const overall = ranked(agg.all.all);
  const bottom = overall.slice(-2);
  if (bottom.length === 2) {
    out.push({ kind: 'grow', text: `${andList(bottom.map((x) => label[x.c]))} reach the fewest buyers (${Math.round(bottom[0].s.mean)} and ${Math.round(bottom[1].s.mean)} on average). Spend there buys awareness, not pipeline.` });
  }
  return out;
}
