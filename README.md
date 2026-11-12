# Meshy GTM Simulator

A synthetic market of Meshy's buyers, built to test SMB acquisition messaging before a dollar goes to media. Forked from my [GTM Simulator](https://github.com/jamesallgood99/gtm-simulator) for the Meshy Demand Generation Lead take-home.

Built by [James Allgood](https://www.linkedin.com/in/jamesallgood). Companies and people are fictional. The market is built from public sources: Meshy's own pages, a messaging teardown, and a readout of 1,828 Trustpilot and G2 reviews.

## What's in the market

**100 companies, split evenly across four segments.** Each company carries the buying committee its segment really has, so the market holds 355 personas.

| Segment | Companies | Who sits on the committee | Personas |
|---|---|---|---|
| Amateurs | 25 | One person: a weekend maker, hobby game builder or adult student creator | 25 |
| Individual pros and startups | 25 | A solo dev, freelance 3D artist, agent builder or print shop owner; product-visual startups add a developer | 30 |
| SMB game studios (10 to 200) | 25 | Studio head, art director, environment artist, tech artist, producer | 125 |
| Large studios and publishers (200+) | 25 | VP of Art, CTO, R&D lead, legal, InfoSec, procurement, senior artist | 175 |

**Pain is variable.** Every persona gets their role's core pains, a pain specific to their type of company where one exists (a live-service art director feels the update cadence, an outsourcer's legal team has to prove clean AI use to clients), and optional pains sampled up to 3 to 5 in total. Intensity moves with how much pressure the company is under, so two art directors feel the same problem differently. Pain levels (high, medium, low) are relative within each segment. The Talk page lists every persona's pains with a description and an intensity bar.

**Competitors are loaded.** Tripo AI, Hyper3D Rodin, Tencent Hunyuan3D and Google Antigravity, with their positioning and feature messages in their own words, are preloaded on the Competition page. Every persona also has the tool or alternative they use today (Tripo, outsourcing, Blender by hand, a self-hosted model, "our AI policy says not yet"), and they judge every message against it.

**Veto roles come from the data.** The environment artist, tech artist, studio head, legal, InfoSec, procurement, CTO and senior artist can block a deal, and the dashboard flags any message that loses them.

**Sampling is equal by segment.** A 100-persona run scores 25 from each segment, spread across the roles in each segment and across pain levels.

## The documents it tests

Two documents are preloaded on the Documents page, built from Tasks 1 and 2 of the take-home:

- `app/public/data/samples/meshy-mrd.md`: segments, buying group, competitive landscape, capabilities in scope, pricing, the claims and proof table, what the reviews say, and the three-channel acquisition plan.
- `app/public/data/samples/meshy-creative-brief.md`: the ask, audience, single-minded proposition, tone, mandatories, and three directions (Pipeline, Control, Craft).

The brief Claude would extract from them, and the three message directions, are already loaded. Click **Read documents and write messaging** to have Claude re-read them and write fresh directions.

## Demo data: walk through it without a key

The dashboard opens as if the market had run once, so every page can be explored without an API key: Compare, Score, Talk, Stress, Adoption and Competition all have results. **The demo is not model output.** Scores come from a simple, transparent heuristic in `market/make_demo_results.py` (theme fit with each persona's pains, whether the framing serves their role, proof in the message, skepticism), and reactions are canned lines per role. The dashboard says so on every page. Add a Claude API key to replace it with a live run.

The demo's shape is the hypothesis a live run tests. Variant A (Pipeline) lands best overall and wins art directors, tech artists and CTOs, but it loses the roles that can block a deal: environment and senior artists, legal and InfoSec, all to Variant B (Control). Variant C (Craft) wins freelancers and artists but can't carry legal or procurement.

## Run it

```bash
cd app
npm install
npm run dev
```

Open **Settings** and paste a [Claude API key](https://console.anthropic.com). The key stays in your browser (session storage, or local storage if you tick "remember") and goes only to `api.anthropic.com`. Then:

| Mode | What it does | Cost |
|---|---|---|
| **Compare** | Scores the three directions against 100 personas, by role, segment, pain level and company type | 15 calls |
| **Talk** | Interview any persona live. They push back from their pains, role and current tool | 1 call per message |
| **Stress** | Your toughest critics attack the weakest claim, and you get a rewrite that survives | 1 call |
| **Adoption** | How each persona takes to each capability at 90 days and 12 months | about 10 calls at 50 personas |
| **Competition** | Meshy's message for each capability against each competitor's, scored blind | about 54 calls at 50 personas |

## Rebuild the market

Everything about the market lives in `market/meshy.config.json`: segments, company types, triggers, current tools, roles, pains and competitors.

```bash
python market/generate_market.py     # writes market/output/ and app/public/data/market.json
python market/make_demo_data.py      # writes the preloaded brief, campaign and competitor messages
python market/make_demo_results.py   # adds heuristic demo results for every page
```

Both scripts use only the Python standard library.

## Deploy

The included workflow builds and publishes the dashboard to GitHub Pages on every push to `main`. In the repo, go to **Settings → Pages** and set the source to **GitHub Actions**.

## How the numbers work

Each persona returns a 0 to 100 interest score with a confidence. The dashboard treats each score as a distribution, runs 2,000 simulated markets by resampling personas, and reports mean interest with an 80% range, the top-20% outcome, and the share scoring above 70. If two variants' ranges overlap, the dashboard calls it a tie.

It's better at telling you a message will land flat than at telling you exactly why. Use it to narrow options and find the questions worth asking, then have the real conversations.

## License

MIT.
