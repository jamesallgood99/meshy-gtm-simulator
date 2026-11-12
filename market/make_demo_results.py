#!/usr/bin/env python3
"""
Fill app/public/data/demo/meshy.json with demo results for every page: Compare, Talk, Stress,
Adoption and Competition, as if the market had been run once.

These are NOT model output. Scores come from a simple, transparent heuristic: how strongly each
message speaks to the themes a persona's pains are tagged with, whether the framing serves or
threatens their role, how much proof the message carries, and their skepticism. Reactions are
canned lines per role. The dashboard labels all of it as demo data. Add a Claude API key in the
dashboard to run the market for real.

    python market/make_demo_data.py      # brief, campaign, competitor messages
    python market/make_demo_results.py   # demo results on top
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MARKET = json.loads((ROOT / "app/public/data/market.json").read_text())
DEMO_PATH = ROOT / "app/public/data/demo/meshy.json"
DEMO = json.loads(DEMO_PATH.read_text())
P = {p["id"]: p for p in MARKET["personas"]}
rng = random.Random(21)


def clamp(x, lo=3, hi=97):
    return int(max(lo, min(hi, round(x))))


# ---------------------------------------------------------------------------------------------
# Sample: equal share per segment, spread across the segment's roles and pain levels, the same
# rule the dashboard uses for a live run.
# ---------------------------------------------------------------------------------------------
def sample(size, seed):
    r = random.Random(seed)
    out = []
    per_seg = round(size / len(MARKET["segments"]))
    for seg in MARKET["segments"]:
        pools = {k: [p for p in MARKET["personas"] if p["role"] == k] for k in seg["roles"]}
        quota = {k: 0 for k in seg["roles"]}
        left = per_seg
        while left > 0:
            open_ = [k for k in seg["roles"] if quota[k] < len(pools[k])]
            if not open_:
                break
            for k in open_:
                if left > 0:
                    quota[k] += 1
                    left -= 1
        for k, n in quota.items():
            by_level = {lvl: [p for p in pools[k] if p["pain_level"] == lvl] for lvl in ("High", "Medium", "Low")}
            for v in by_level.values():
                r.shuffle(v)
            picked, i = [], 0
            while len(picked) < n and any(by_level.values()):
                lvl = ("High", "Medium", "Low")[i % 3]
                if by_level[lvl]:
                    picked.append(by_level[lvl].pop())
                i += 1
            out.extend(picked)
    return out


def theme_fit(p, weights):
    """Intensity-weighted share of a persona's pain that a message speaks to (0-1)."""
    num = den = 0.0
    for x in p["pains"]:
        w = max((weights.get(t, 0) for t in x["tags"]), default=0)
        num += x["intensity"] * w
        den += x["intensity"]
    return num / den if den else 0


def message_score(p, themes, stake, proof, extra=0.0):
    fit = theme_fit(p, themes)
    s = 26 + 50 * fit + 20 * stake + 14 * proof * p["skepticism"] - 18 * p["skepticism"] * (1 - proof)
    s += 6 * (1 - p["change_fatigue"]) - 3 + extra + rng.gauss(0, 7)
    return clamp(s)


def confidence(p, s, fit):
    if s >= 75 or s <= 25 or fit > 0.6:
        return "high"
    return "low" if p["skepticism"] > 0.75 and 40 <= s <= 60 else "medium"


# ---------------------------------------------------------------------------------------------
# Compare: the three directions from the creative brief.
# ---------------------------------------------------------------------------------------------
VARIANT = {
    "A": {"themes": {"speed": 1.0, "pipeline": 1.0, "quality": 0.45, "cost": 0.35, "privacy": 0.25, "ip": 0.2}, "proof": 0.75},
    "B": {"themes": {"ip": 1.0, "privacy": 1.0, "compliance": 0.65, "jobs": 0.35, "craft": 0.3, "speed": 0.35, "pipeline": 0.25}, "proof": 0.65},
    "C": {"themes": {"craft": 1.0, "jobs": 0.6, "differentiation": 0.55, "speed": 0.5, "ip": 0.3, "revenue": 0.3}, "proof": 0.3},
}
# Positive = the framing serves this role. Negative = it reads as a threat or misses their job.
STAKE = {
    "A": {"maker": 0.1, "hobby_dev": 0.3, "student": 0.0, "solo_dev": 0.35, "freelancer": -0.25, "agent_builder": 0.2,
          "startup_founder": 0.2, "print_shop": 0.15, "studio_head": 0.15, "art_director": 0.45, "env_artist": -0.45,
          "tech_artist": 0.35, "producer": 0.45, "vp_art": 0.2, "cto": 0.15, "rnd_lead": 0.35, "legal": -0.35,
          "infosec": -0.2, "procurement": 0.0, "senior_artist": -0.55},
    "B": {"maker": 0.0, "hobby_dev": -0.15, "student": 0.0, "solo_dev": 0.15, "freelancer": 0.25, "agent_builder": -0.1,
          "startup_founder": 0.1, "print_shop": 0.15, "studio_head": 0.45, "art_director": 0.05, "env_artist": 0.3,
          "tech_artist": -0.15, "producer": -0.15, "vp_art": 0.25, "cto": 0.15, "rnd_lead": 0.1, "legal": 0.55,
          "infosec": 0.45, "procurement": 0.15, "senior_artist": 0.15},
    "C": {"maker": 0.4, "hobby_dev": 0.15, "student": 0.35, "solo_dev": 0.1, "freelancer": 0.45, "agent_builder": -0.35,
          "startup_founder": -0.1, "print_shop": 0.2, "studio_head": 0.05, "art_director": 0.2, "env_artist": 0.35,
          "tech_artist": -0.3, "producer": -0.25, "vp_art": 0.1, "cto": -0.35, "rnd_lead": -0.05, "legal": -0.45,
          "infosec": -0.4, "procurement": -0.35, "senior_artist": 0.25},
}

# (reaction if it lands, reaction if it doesn't, objection) per role and variant. Canned lines.
REACT = {
    "maker": {
        "A": ("If it really spits out a file I can print tonight, I'm in.", "Pipeline? I just want a mini for Saturday.", "Talks like it's for studios"),
        "B": ("Good to know what I make is mine. That's more than some free tools promise.", "Nice, but will it charge me for a year when I click monthly?", "Silent on billing"),
        "C": ("That's it exactly. The villain is my idea. I just can't sculpt it.", "Sounds nice. Does it actually print without failing?", "No proof it prints"),
    },
    "hobby_dev": {
        "A": ("Props straight into Godot is exactly what my empty scenes need.", "My pipeline is me on a Sunday. Is the free tier enough?", "Unclear what's free"),
        "B": ("Fine, but I mostly care if I can export it.", "Licensing talk doesn't fill my scene.", "Doesn't say what I get"),
        "C": ("I'd like my game to feel like mine, not an asset flip.", "Nice words. Show me a character in Unity.", "No engine proof"),
    },
    "student": {
        "A": ("Fast is good. My project is due in two weeks.", "Is there a student price? That's my question.", "Price not mentioned"),
        "B": ("Owning my work matters for my portfolio.", "I'm not a studio. This isn't for me.", "Written for companies"),
        "C": ("I want my style in 3D. A free certification would help my portfolio.", "Will my instructor accept it?", "Unclear if AI is allowed"),
    },
    "solo_dev": {
        "A": ("98% faster is a real number. A whole cast in my pipeline is the dream.", "Every tool says fast. Will the set look consistent?", "Consistency across a set"),
        "B": ("Clean commercial rights is the first thing Steam and publishers ask about.", "Rights are good. I still need assets that don't look AI-made.", "Quality not addressed"),
        "C": ("I like that the vision stays mine.", "Feels aimed at artists. I need throughput.", "No numbers"),
    },
    "freelancer": {
        "A": ("Quick blockouts I finish myself could work.", "Speed is how clients learn to pay me less.", "Devalues the craft"),
        "B": ("Clients keep asking who owns AI-assisted work. This answers it.", "Ownership is table stakes. What about topology?", "Cleanup cost"),
        "C": ("Rough it out, I sign it. That's a split I can live with.", "Nice line. The certification might even help with clients.", "Still worried about rates"),
    },
    "agent_builder": {
        "A": ("If the API drops meshes into my pipeline, that's the whole pitch.", "Which pipeline? Show me the API docs and rate limits.", "No API detail"),
        "B": ("Licensed data helps when my client's legal team asks.", "Not my problem. I need cost per call and uptime.", "No cost or limits"),
        "C": ("Cute.", "This is for artists. I build systems.", "Wrong audience"),
    },
    "startup_founder": {
        "A": ("Into our existing pipeline at 98% faster would cut our agency bill.", "Our pipeline is a Shopify page. Web-ready file sizes?", "Web polycount"),
        "B": ("Private by default matters for unreleased products.", "Fine, but cost at volume is the decision.", "No pricing"),
        "C": ("Not really how I think about product shots.", "We need volume, not artistry.", "Wrong frame"),
    },
    "print_shop": {
        "A": ("Faster from idea to printable file is my whole margin.", "Pipeline means slicer for me. Is it watertight?", "Print success not shown"),
        "B": ("I can only sell designs I own, so this matters.", "Ownership yes, but failed prints are my real cost.", "No print proof"),
        "C": ("My customers buy my designs. Keeping my look matters.", "Sounds good, but I need throughput before Christmas.", "No speed proof"),
    },
    "studio_head": {
        "A": ("Faster inside what we already run, with a case study. Worth a call.", "My artists will read 98% faster as a headcount plan.", "Team reaction"),
        "B": ("Licensed data and opt-out is the answer my publisher wants. I can forward this.", "Good start. Do I get it in writing for the publisher?", "Needs it in the contract"),
        "C": ("I like that it respects the artists.", "Warm, but what does it do to cost per asset?", "No cost case"),
    },
    "art_director": {
        "A": ("Straight into Unreal, finished by my team. That clears the prop backlog.", "Every tool says minutes. I've seen the cleanup.", "Cleanup work"),
        "B": ("Helps with the team's worries, honestly.", "Trust is nice. Can it hit our art bar?", "Quality not shown"),
        "C": ("My team would read this better than most AI pitches.", "Lovely line. Show me a matched set of props.", "No set consistency"),
    },
    "env_artist": {
        "A": ("If it only does the crates, maybe.", "Faster for whom? Sounds like fewer of us.", "Reads as replacement"),
        "B": ("Licensed data and nothing trains on my work is the first thing I'd ask.", "Still AI. Who checks the licensed data claim?", "Doesn't trust the claim"),
        "C": ("If I decide what it touches and the signature stays mine, I'll look.", "Life is the part they'll say is optional next year.", "Distrusts the framing"),
    },
    "tech_artist": {
        "A": ("Straight into our pipeline is my first question. Poly targets?", "Existing pipeline means our budgets and topology. Not mentioned.", "No poly budgets"),
        "B": ("Fine for legal. Doesn't help me ship.", "Nothing here about topology or export.", "No technical detail"),
        "C": ("Nice sentiment.", "Marketing copy. Give me poly counts.", "No specs"),
    },
    "producer": {
        "A": ("Hours not days for background props saves my milestone.", "Pilots like this eat weeks. Fixed scope?", "Pilot risk"),
        "B": ("Legal will be happier.", "Doesn't help my schedule.", "No schedule benefit"),
        "C": ("Team morale matters to me too.", "I need dates, not feelings.", "No schedule benefit"),
    },
    "vp_art": {
        "A": ("More content with the same team is my year.", "Our bar is higher than a playtest.", "Quality bar"),
        "B": ("Nothing trained on our art is non-negotiable, so this is a good start.", "I'll need legal's read before I care.", "Needs legal review"),
        "C": ("AI that serves art direction is the only kind I'd approve.", "Nice words for a franchise this size.", "No scale proof"),
    },
    "cto": {
        "A": ("Fits the existing pipeline is the right promise. Show me the API.", "Or we self-host an open model for free.", "Build vs. buy"),
        "B": ("Contractual no-training and retention control clears a big hurdle.", "SSO and retention are table stakes.", "No architecture detail"),
        "C": ("Not a technical message.", "Nothing here I can evaluate.", "No specs"),
    },
    "rnd_lead": {
        "A": ("A pipeline story with a case study is something I can take upward.", "I need repeatable results, not a headline.", "Repeatability"),
        "B": ("Gets legal off my back during the pilot.", "Helps the pilot, doesn't win it.", "No pilot proof"),
        "C": ("Might calm the artists during a pilot.", "Leadership won't fund a feeling.", "No numbers"),
    },
    "legal": {
        "A": ("Speed is not my department.", "Nothing about provenance or indemnity.", "No IP terms"),
        "B": ("Licensed training data and no training on inputs are the right first claims. I'll want them in writing.", "Claims are cheap. Show me the contract language and indemnity.", "Indemnity"),
        "C": ("Not a legal message.", "Life is a creative claim. Who owns the output?", "Ownership unclear"),
    },
    "infosec": {
        "A": ("Not my concern.", "Where does the data go when it hits the pipeline?", "Data flow unclear"),
        "B": ("Private by default is the right default. Send the SOC 2.", "I'll need the SOC 2 report under NDA.", "Wants audit report"),
        "C": ("Not for me.", "Nothing about security.", "No security detail"),
    },
    "procurement": {
        "A": ("If it cuts outsourcing spend, I'll listen.", "What does it cost per seat at volume?", "No pricing"),
        "B": ("Clear terms help procurement.", "Is this on standard paper?", "Non-standard terms"),
        "C": ("Not relevant to procurement.", "No commercial terms.", "No terms"),
    },
    "senior_artist": {
        "A": ("Only if it stays on the grind work.", "98% faster is the line they'll put in the layoff deck.", "Reads as layoffs"),
        "B": ("Licensed data is the minimum. I'd want to see it.", "Every vendor says licensed. Prove it.", "Doesn't trust provenance"),
        "C": ("At least it says the art is ours.", "Nice words until the budget meeting.", "Distrusts intent"),
    },
}


def compare_rows(personas):
    out = {}
    for vid, v in VARIANT.items():
        rows = []
        for p in personas:
            s = message_score(p, v["themes"], STAKE[vid][p["role"]], v["proof"])
            pos, neg, obj = REACT[p["role"]][vid]
            rows.append({
                "persona_id": p["id"], "score": s,
                "confidence": confidence(p, s, theme_fit(p, v["themes"])),
                "reaction": pos if s >= 60 else neg,
                "objection": obj,
            })
        out[vid] = rows
    return out


# ---------------------------------------------------------------------------------------------
# Talk: one sample interview with a skeptical environment artist.
# ---------------------------------------------------------------------------------------------
def talk(personas):
    artist = next(p for p in personas if p["role"] == "env_artist" and p["pain_level"] == "High") \
        if any(p["role"] == "env_artist" and p["pain_level"] == "High" for p in personas) \
        else next(p for p in personas if p["role"] == "env_artist")
    return {"persona_id": artist["id"], "transcript": [
        {"role": "user", "text": "Meshy gives your team base meshes in minutes, inside your existing pipeline, so you can spend your time on the work that matters."},
        {"role": "persona", "text": "The work that matters. So the props don't? Half my job is props. When a studio says AI will save time, I hear that they'll need fewer of us. And I'd want to know what your model was trained on."},
        {"role": "user", "text": "Fair. Meshy is trained only on licensed data, and your studio can switch off training on anything you make. You decide what it touches. Most teams start with background props and keep hero assets by hand."},
        {"role": "persona", "text": "Licensed is a word every vendor uses. If I could see where the data came from, and my lead put in writing that we pick what goes to the tool, I'd try it on crates and barrels. Not on anything with my name on it."},
        {"role": "user", "text": "That's how we'd run the pilot: your team picks the asset list, and there's a free certification so you're the one who knows the tool best."},
        {"role": "persona", "text": "The certification is interesting, actually. If the studio uses this anyway, I'd rather be the one who knows it. But the first 500k-triangle crate I have to retopologize, I'm out, and I'll be the one telling the team whether it's worth it."},
    ]}


# ---------------------------------------------------------------------------------------------
# Stress: the weakest claim in the MRD against the toughest critics.
# ---------------------------------------------------------------------------------------------
def stress(personas):
    """Attacks come from the same five critics the Stress page lists: ranked by skepticism, low pain
    on the claim's theme and role stakes, at most two per role (toughestCritics in stats.js)."""
    stakes = {r["key"]: r["stakes"] for r in MARKET["roles"]}
    ti = lambda p, t: max([x["intensity"] for x in p["pains"] if t in x["tags"]] + [0])
    ranked = sorted(MARKET["personas"], key=lambda p: -(p["skepticism"] * 0.5 + (1 - ti(p, "quality")) * 0.3 + stakes[p["role"]] * 0.2))
    critics, per = [], {}
    for p in ranked:
        if per.get(p["role"], 0) >= 2:
            continue
        per[p["role"]] = per.get(p["role"], 0) + 1
        critics.append(p)
        if len(critics) == 5:
            break
    ATTACK = {
        "env_artist": [
            (5, "I've seen the 500k-triangle crates. Final means I can't tell it was generated, and we're not there. Call it final and my lead will expect me to ship it as is.", "Before-and-after meshes from a real studio, with the cleanup time measured."),
            (4, "One-click final is what management hears. Then the prop budget gets cut and I'm the one fixing AI meshes on the weekend.", "A claim scoped to base meshes, with artists finishing the work."),
        ],
        "senior_artist": [
            (5, "One-click final assets is exactly the sentence that ends up in a layoff deck. If the tool did that, you wouldn't need us. It doesn't, and saying it makes every artist on the team your enemy.", "A claim scoped to base meshes and background props, with artists finishing the work."),
            (4, "Production-ready on a flagship title means it passes art review. Nothing generated has passed ours. Overclaim it and the guild has its next post.", "A published blind review by senior artists, with the test set and method."),
        ],
        "legal": [
            (3, "Final assets that ship in a game need clean provenance and an indemnity behind them. If you claim production use, I need the terms that cover production use.", "Indemnity terms for shipped assets and the licensed-data statement in the contract."),
        ],
    }
    used = {}
    attacks = []
    for p in critics:
        i = used.get(p["role"], 0)
        used[p["role"]] = i + 1
        sev, text, ev = ATTACK[p["role"]][i]
        attacks.append({"persona_id": p["id"], "severity": sev, "attack": text, "evidence_needed": ev})
    attacks.sort(key=lambda a: -a["severity"])
    return {
        "claim": "Production-ready, one-click final assets.",
        "theme": "quality",
        "attacks": attacks,
        "rewrite": "Base meshes for props and background assets in minutes, ready for your team to finish in Blender or the engine. 37 Interactive cut high-poly work by 30 to 40%.",
        "rewrite_rationale": "Drops 'production-ready' and 'one-click', which every critic attacked, scopes the promise to the hybrid pipeline with artists finishing the work, and uses the one cleanup-related proof point in the MRD.",
    }


# ---------------------------------------------------------------------------------------------
# Adoption: every persona in a 50-person sample against every capability.
# ---------------------------------------------------------------------------------------------
FEATURES = {f["id"]: f for f in DEMO["brief"]["features"]}
SETUP = {"low": 0.0, "medium": 0.5, "high": 1.0}
# 12-month use relative to 90 days. Below 1 = novelty fades. Above 1 = value compounds.
DURABILITY = {"F1": 0.95, "F2": 0.85, "F3": 1.05, "F4": 1.2, "F5": 1.15, "F6": 1.25, "F7": 1.1, "F8": 0.8}
NOTE = {
    "F1": ("A model from a sketch in a minute is the part I'd use every week.", "Useful, but it isn't my job."),
    "F2": ("Rigging in the same tool saves me a Mixamo round trip.", "I don't rig anything."),
    "F3": ("Watertight on the first try would save me filament and nights.", "We don't print."),
    "F4": ("If it lands in Unreal at our budget, it becomes part of the pipeline.", "Someone else owns the pipeline."),
    "F5": ("An API means it runs inside our tools, not beside them.", "I won't touch the API."),
    "F6": ("Shared credits and one switch to keep our work out of training is how a team buys this.", "Doesn't change my day."),
    "F7": ("SSO, retention and no-training in the contract are what I'd need to approve it.", "Not my area."),
    "F8": ("A certification I can put on my profile makes this about my skills, not my replacement.", "I don't need a certificate to use a tool."),
}


def adoption(personas):
    rows = []
    for p in personas:
        for fid, f in FEATURES.items():
            primary = p["role"] in f["primary_roles"]
            fit = theme_fit(p, {t: 1.0 for t in f["themes"]})
            enth = 18 + 45 * fit + (28 if primary else 0) - 10 * p["skepticism"] + rng.gauss(0, 8)
            if fid == "F8" and p["role"] in ("env_artist", "senior_artist") and any(x["key"] in ("job_fear", "layoffs") and x["intensity"] > 0.7 for x in p["pains"]):
                enth -= 12  # the most fearful artists distrust the certification too
            enth = clamp(enth)
            base = enth * (0.75 if primary else 0.35) - 12 * SETUP[f["setup_effort"]] - 8 * p["change_fatigue"]
            a90 = clamp(base + rng.gauss(0, 5), 1, 95)
            a12 = clamp(a90 * DURABILITY[fid] + rng.gauss(0, 4), 1, 95)
            rows.append({"persona_id": p["id"], "feature_id": fid, "enthusiasm": enth, "adopt_90d": a90,
                         "adopt_12m": a12, "note": NOTE[fid][0] if enth >= 55 else NOTE[fid][1]})
    return {"sample_ids": [p["id"] for p in personas], "rows": rows}


# ---------------------------------------------------------------------------------------------
# Competition: Meshy's message for each capability against each competitor's, read blind.
# ---------------------------------------------------------------------------------------------
# themes the copy speaks to, proof inside the copy (0-1), and a trust signal (licensed, private).
MSG = {
    ("F1", "ours"): ({"speed": 1.0, "pipeline": 0.6, "craft": 0.3}, 0.3, 0.0),
    ("F1", "tripo"): ({"speed": 1.0}, 0.2, 0.0),
    ("F1", "rodin"): ({"quality": 1.0, "differentiation": 0.4}, 0.2, 0.0),
    ("F1", "hunyuan"): ({"cost": 1.0, "quality": 0.7}, 0.4, -0.2),
    ("F2", "ours"): ({"speed": 0.9, "pipeline": 0.7}, 0.5, 0.0),
    ("F2", "hunyuan"): ({"pipeline": 0.8, "quality": 0.4}, 0.2, -0.2),
    ("F3", "ours"): ({"quality": 1.0, "pipeline": 0.8, "cost": 0.4}, 0.7, 0.0),
    ("F4", "ours"): ({"pipeline": 1.0, "quality": 0.6, "speed": 0.4}, 0.7, 0.0),
    ("F4", "tripo"): ({"quality": 1.0, "pipeline": 0.9}, 0.6, 0.0),
    ("F4", "rodin"): ({"pipeline": 0.8, "quality": 0.7}, 0.4, 0.0),
    ("F5", "ours"): ({"pipeline": 1.0, "speed": 0.6}, 0.4, 0.0),
    ("F5", "hunyuan"): ({"pipeline": 0.8, "cost": 0.8}, 0.3, -0.3),
    ("F5", "antigravity"): ({"pipeline": 0.7, "speed": 0.8}, 0.2, 0.0),
    ("F6", "ours"): ({"privacy": 1.0, "cost": 0.5, "ip": 0.6}, 0.5, 0.3),
    ("F6", "tripo"): ({"compliance": 0.7}, 0.4, 0.0),
    ("F6", "rodin"): ({"compliance": 0.8, "pipeline": 0.3}, 0.4, 0.1),
    ("F7", "ours"): ({"ip": 1.0, "privacy": 1.0, "compliance": 1.0}, 0.8, 0.5),
    ("F7", "rodin"): ({"ip": 0.8, "compliance": 0.8}, 0.4, 0.3),
}
COMP_REACT = {
    "ours": ("Specific enough to try.", "Sounds like every AI tool.", "Needs a demo on our assets"),
    "tripo": ("Fast and quads is a strong pair, if true.", "Seconds and quads both? I'd test that.", "Too good to be true"),
    "rodin": ("Quality and control is what pros care about.", "Highest quality says nothing measurable.", "Superlative, no proof"),
    "hunyuan": ("Free is hard to argue with.", "Free from a big company makes procurement nervous.", "Ownership and license questions"),
    "antigravity": ("An agent doing the whole job is interesting.", "Code-built geometry won't pass art review.", "Not real assets"),
}


def competition(personas):
    comp = DEMO["competition"]
    results = {}
    for fid in comp["features"]:
        results[fid] = {}
        f = FEATURES[fid]
        for brand, text in comp["messages"][fid].items():
            if not text.strip():
                continue
            themes, proof, trust = MSG.get((fid, brand), ({t: 0.7 for t in f["themes"]}, 0.3, 0.0))
            rows = []
            for p in personas:
                main = p["role"] in f["primary_roles"]
                trust_pull = trust * (0.5 + max((x["intensity"] for x in p["pains"] if {"ip", "privacy", "jobs"} & set(x["tags"])), default=0))
                s = message_score(p, themes, (0.15 if main else -0.05) + trust_pull * 0.6, proof)
                pos, neg, obj = COMP_REACT[brand]
                rows.append({"persona_id": p["id"], "score": s, "confidence": confidence(p, s, theme_fit(p, themes)),
                             "reaction": pos if s >= 60 else neg, "objection": obj})
            results[fid][brand] = rows
    comp["results"] = results
    comp["sample_ids"] = [p["id"] for p in personas]
    return comp


def main():
    panel = sample(100, 3)
    DEMO["sample_ids"] = [p["id"] for p in panel]
    DEMO["results"] = compare_rows(panel)
    DEMO["talk"] = talk(panel)
    DEMO["stress"] = stress(panel)
    DEMO["adoption"] = adoption(sample(50, 5))
    DEMO["competition"] = competition(sample(50, 7))
    DEMO["generated_by"] = "market/make_demo_results.py (heuristic, not a model)"
    DEMO["note"] = "Demo data. Scored by a transparent heuristic, not a model. Reactions are canned per role. Add a Claude API key to run the market live."
    DEMO_PATH.write_text(json.dumps(DEMO, indent=1))

    # Quick read of the shape, so the heuristic can be sanity-checked.
    seg = lambda p: P[p]["industry"]
    for vid, rows in DEMO["results"].items():
        by = {}
        for r in rows:
            by.setdefault(seg(r["persona_id"]), []).append(r["score"])
        overall = sum(r["score"] for r in rows) / len(rows)
        above = sum(r["score"] > 70 for r in rows) / len(rows)
        print(vid, f"mean {overall:.0f}, above70 {above:.0%} |", " | ".join(f"{k.split()[0]} {sum(v)/len(v):.0f}" for k, v in by.items()))
    roles = {}
    for vid, rows in DEMO["results"].items():
        for r in rows:
            roles.setdefault(P[r["persona_id"]]["role"], {}).setdefault(vid, []).append(r["score"])
    for role, d in roles.items():
        print(f"  {role:16}", "  ".join(f"{v}:{sum(x)/len(x):.0f}" for v, x in d.items()))


if __name__ == "__main__":
    main()
