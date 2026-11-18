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
    "A": {"themes": {"quality": 0.8, "pipeline": 0.6, "speed": 0.5, "differentiation": 0.3}, "proof": 0.35},
    "B": {"themes": {"speed": 1.0, "pipeline": 1.0, "quality": 0.45, "cost": 0.35, "privacy": 0.25, "ip": 0.2}, "proof": 0.75},
    "C": {"themes": {"ip": 1.0, "privacy": 1.0, "compliance": 0.65, "jobs": 0.35, "craft": 0.3, "speed": 0.35, "pipeline": 0.25}, "proof": 0.65},
    "D": {"themes": {"craft": 1.0, "jobs": 0.6, "differentiation": 0.55, "speed": 0.5, "ip": 0.3, "revenue": 0.3}, "proof": 0.3},
}
# Positive = the framing serves this role. Negative = it reads as a threat or misses their job.
STAKE = {
    "A": {"studio_lead": -0.1, "art_lead": -0.15, "tech_lead": -0.1, "artist": -0.1, "producer": 0.0,
          "risk_gate": -0.35, "indie_owner": 0.3, "developer": -0.05},
    "B": {"studio_lead": 0.17, "art_lead": 0.4, "tech_lead": 0.25, "artist": -0.42, "producer": 0.45,
          "risk_gate": -0.18, "indie_owner": 0.23, "developer": 0.2},
    "C": {"studio_lead": 0.35, "art_lead": 0.08, "tech_lead": 0.0, "artist": 0.23, "producer": -0.15,
          "risk_gate": 0.38, "indie_owner": 0.13, "developer": -0.1},
    "D": {"studio_lead": 0.08, "art_lead": 0.08, "tech_lead": -0.32, "artist": 0.35, "producer": -0.25,
          "risk_gate": -0.4, "indie_owner": 0.07, "developer": -0.35},
}

# (reaction if it lands, reaction if it doesn't, objection) per role and variant. Canned lines.
REACT = {
    "studio_lead": {
        "A": ("If 15 million people use it, it's worth having someone look.", "A printing tool with a games line. Where's the studio story?", "No studio proof"),
        "B": ("Faster inside what we already run, with a case study. Worth a call.", "My artists will read 98% faster as a headcount plan.", "Team reaction"),
        "C": ("Licensed data and opt-out is the answer my publisher wants. I can forward this.", "Good start. Do I get it in writing for the publisher?", "Needs it in the contract"),
        "D": ("AI that serves the art, not the other way round, is the only kind I'd approve.", "Warm, but what does it do to cost per asset?", "No cost case"),
    },
    "art_lead": {
        "A": ("Playable is fine for a prototype sprint.", "Get your game playable is a prototype pitch. I ship games.", "Prototype, not production"),
        "B": ("Straight into Unreal, finished by my team. That clears the prop backlog.", "Every tool says minutes. I've seen the cleanup.", "Cleanup work"),
        "C": ("Helps with the team's worries, honestly, and gets legal off my back during the pilot.", "Trust is nice. Can it hit our art bar?", "Quality not shown"),
        "D": ("My team would read this better than most AI pitches.", "Lovely line. Show me a matched set of props.", "No set consistency"),
    },
    "tech_lead": {
        "A": ("Watertight and auto-repair says they care about clean geometry.", "Watertight is for printers. Nothing about quads, poly budgets or Unreal.", "No engine specs"),
        "B": ("Straight into our pipeline is my first question. Poly targets? API?", "Existing pipeline means our budgets and topology. Or we self-host an open model.", "No poly budgets"),
        "C": ("Contractual no-training and retention control clears a real hurdle.", "Fine for legal. Nothing here about topology or export.", "No technical detail"),
        "D": ("Nice sentiment.", "Marketing copy. Give me poly counts.", "No specs"),
    },
    "artist": {
        "A": ("At least it isn't promising to replace anyone.", "AI assets for my game? That's my job they're describing.", "AI assets framing"),
        "B": ("If it only does the crates, maybe.", "Faster for whom? 98% faster is the line they'll put in the layoff deck.", "Reads as replacement"),
        "C": ("Licensed data and nothing trains on my work is the first thing I'd ask.", "Every vendor says licensed. Who checks?", "Doesn't trust the claim"),
        "D": ("If I decide what it touches and the signature stays mine, I'll look.", "Nice words until the budget meeting.", "Distrusts the framing"),
    },
    "producer": {
        "A": ("Playable sooner would help a milestone.", "Nothing about schedules or a pilot.", "No schedule case"),
        "B": ("Hours not days for background props saves my milestone.", "Pilots like this eat weeks. Fixed scope?", "Pilot risk"),
        "C": ("Legal will be happier.", "Doesn't help my schedule.", "No schedule benefit"),
        "D": ("Team morale matters to me too.", "I need dates, not feelings.", "No schedule benefit"),
    },
    "risk_gate": {
        "A": ("Popular, fine. Popular is not a security posture.", "No word on training data, ownership or security.", "No trust content"),
        "B": ("Speed is not my department.", "Nothing about provenance, data flow or terms.", "No IP or security terms"),
        "C": ("Licensed training data, private by default, no training on inputs. Right claims. Send the contract language and the SOC 2.", "Claims are cheap. Show me the indemnity and the audit report.", "Indemnity and audit"),
        "D": ("Not a message for legal or security.", "Who owns the output? Where does the data go?", "Ownership unclear"),
    },
    "indie_owner": {
        "A": ("Print-ready straight into my slicer is exactly my problem.", "Big numbers. Does it work for my catalog?", "Generic proof"),
        "B": ("98% faster is a real number. A whole set in my pipeline beats a contractor quote.", "Every tool says fast. Will the set look consistent?", "Consistency across a set"),
        "C": ("Clean commercial rights is the first thing a store or publisher asks about.", "Rights are good. I still need assets that don't look AI-made.", "Quality not addressed"),
        "D": ("I like that the vision stays mine.", "Feels aimed at artists. I need throughput.", "No numbers"),
    },
    "developer": {
        "A": ("If it's the most-used, the API is probably worth a look.", "Nothing here for developers. Where's the API?", "No API mention"),
        "B": ("If the API drops meshes into my pipeline, that's the whole pitch.", "Which pipeline? Show me the API docs and rate limits.", "No API detail"),
        "C": ("Licensed data helps when my client's legal team asks.", "Not my problem. I need cost per call and uptime.", "No cost or limits"),
        "D": ("Cute.", "This is for artists. I build systems.", "Wrong audience"),
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
# Talk: one sample interview with a skeptical studio production artist.
# ---------------------------------------------------------------------------------------------
def talk(personas):
    studio_artists = [p for p in personas if p["role"] == "artist" and p["segment"] != "pro"]
    artist = next((p for p in studio_artists if p["pain_level"] == "High"), studio_artists[0])
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
        "artist": [
            (5, "One-click final assets is exactly the sentence that ends up in a layoff deck. I've seen the 500k-triangle crates. Call it final and my lead will expect me to ship it as is.", "Before-and-after meshes from a real studio, with the cleanup time measured."),
            (4, "Production-ready means it passes art review. Nothing generated has passed ours. Overclaim it and the guild has its next post.", "A claim scoped to base meshes, with artists finishing the work."),
        ],
        "risk_gate": [
            (4, "Final assets that ship in a game need clean provenance and an indemnity behind them. If you claim production use, I need the terms that cover production use.", "Indemnity terms for shipped assets and the licensed-data statement in the contract."),
            (3, "A production claim with no evidence goes straight into our vendor risk file.", "Published evidence for the claim, or drop it."),
        ],
        "tech_lead": [
            (4, "Production-ready means our poly budget, quad topology and engine-safe textures. You haven't said any of that.", "Poly counts, topology and texture specs on our test set."),
            (3, "If the same prompt gives a clean mesh one run and a broken one the next, nothing is one-click.", "Repeatability numbers across runs."),
        ],
        "studio_lead": [
            (3, "If I repeat 'one-click final' to my team, I lose them. If I repeat it to my publisher, I own it.", "A claim my artists and my publisher can both live with."),
            (3, "My art bar is higher than a playtest. Show me it on a flagship asset.", "A studio case study at shipped quality."),
        ],
    }
    GENERIC = [
        (3, "Every AI tool says production-ready. I'd need to see it on our work.", "A test on the buyer's own assets."),
        (2, "One click is never one click.", "A realistic workflow, start to finish."),
    ]
    used = {}
    attacks = []
    for p in critics:
        i = used.get(p["role"], 0)
        used[p["role"]] = i + 1
        sev, text, ev = ATTACK.get(p["role"], GENERIC)[i]
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
            if fid == "F8" and p["role"] == "artist" and any(x["key"] == "job_fear" and x["intensity"] > 0.7 for x in p["pains"]):
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


# ---------------------------------------------------------------------------------------------
# Channels: each persona in a 48-person sample rates each message in each channel.
# Base affinity = how much this role lives in the channel and trusts it (0-1), from the persona
# doc's channel map. The message's own pull (its Compare score for that persona) moves it up or down.
# ---------------------------------------------------------------------------------------------
CH = ["paid_social", "linkedin", "search", "video", "email", "newsletter", "boards", "creators", "events", "podcasts", "ooh", "tv"]
AFFINITY = {  # social, linkedin, search, video, email, press, boards, creators, events, podcasts, billboards, tv
    "studio_lead":  [.23, .72, .35, .40, .55, .72, .30, .25, .82, .55, .10, .10],
    "art_lead":     [.35, .62, .53, .60, .57, .72, .57, .45, .78, .50, .08, .08],
    "tech_lead":    [.20, .53, .57, .57, .48, .68, .65, .40, .70, .48, .05, .05],
    "artist":       [.38, .42, .33, .58, .23, .52, .62, .52, .50, .37, .07, .10],
    "producer":     [.30, .70, .40, .40, .60, .70, .30, .25, .65, .55, .10, .10],
    "risk_gate":    [.05, .50, .32, .15, .57, .60, .13, .05, .47, .32, .05, .05],
    "indie_owner":  [.58, .47, .72, .68, .47, .47, .63, .62, .50, .45, .13, .12],
    "developer":    [.30, .45, .75, .60, .40, .70, .80, .50, .45, .60, .05, .05],
}
# Canned notes per channel: (receptive, not receptive). Not model output.
CH_NOTE = {
    "paid_social": ("I'd stop scrolling for a model that builds itself in the feed.", "Another AI ad in my feed. I scroll past those."),
    "linkedin": ("On LinkedIn I'm in work mode, so I'd actually read it.", "LinkedIn ads are noise. I don't click them."),
    "search": ("If this showed up when I was searching for a fix, I'd click.", "I'm not searching for this, so I'd never see it."),
    "video": ("Show me it working in a video and I'll watch the whole thing.", "Pre-roll gets skipped. I'm there for the tutorial."),
    "email": ("A short, specific email that knows what we make would get a reply.", "Cold email from a vendor goes straight to archive."),
    "newsletter": ("If 80 Level or the trade press covered it, I'd trust it more.", "I skim newsletters. A sponsored slot won't stick."),
    "boards": ("If people I trust on the forums swear by it, that's what moves me.", "Vendors posting on our boards get roasted. Don't."),
    "creators": ("A creator I follow building something real with it would sell me.", "Sponsored creator videos feel like ads with extra steps."),
    "events": ("Show me at GDC and let me try it on my own asset. That's a meeting.", "I'm not walking a booth for an AI tool."),
    "podcasts": ("A founder talking honestly on a podcast I already listen to would land.", "I don't remember podcast ads."),
    "ooh": ("A billboard wouldn't do anything for me on its own.", "A billboard for a 3D tool? Not my world."),
    "tv": ("A TV spot is a brand thing. It wouldn't change my mind.", "Nobody buys a pipeline tool from a TV ad."),
}


def channels():
    panel = sample(48, 9)
    out = {}
    for vid, v in VARIANT.items():
        msg = next(x for x in DEMO["campaign"]["variants"] if x["id"] == vid)
        rows = []
        for p in panel:
            pull = message_score(p, v["themes"], STAKE[vid][p["role"]], v["proof"]) - 50  # this message's own pull
            for i, c in enumerate(CH):
                a = AFFINITY[p["role"]][i]
                rec = clamp(10 + 70 * a + pull * (0.25 + 0.5 * a) + rng.gauss(0, 6))
                rows.append({"persona_id": p["id"], "channel_id": c, "receptivity": rec,
                             "note": CH_NOTE[c][0] if rec >= 55 else CH_NOTE[c][1]})
        out[vid] = {"variant_id": vid, "message": msg["message"], "sample_ids": [p["id"] for p in panel], "rows": rows}
    return out


def main():
    panel = sample(100, 3)
    DEMO["sample_ids"] = [p["id"] for p in panel]
    DEMO["results"] = compare_rows(panel)
    DEMO["talk"] = talk(panel)
    DEMO["stress"] = stress(panel)
    DEMO["adoption"] = adoption(sample(50, 5))
    DEMO["competition"] = competition(sample(50, 7))
    DEMO["channels"] = channels()
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
