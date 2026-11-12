#!/usr/bin/env python3
"""
Generate a synthetic market with segment-specific buying committees.

Each segment gets an equal (or configured) share of the companies. Each company has a type, and the
type decides who sits on its buying committee: one person for an amateur, five for an SMB studio,
seven for a large studio. Every persona gets their role's core pains, one pain specific to their
role at that type of company where one exists, and optional role pains up to 3-5 in total. Pain
intensity varies with how much pressure the company is under, so the same role feels the same
problem differently from company to company.

    python market/generate_market.py                          # uses meshy.config.json
    python market/generate_market.py --config my_market.json   # your own market

Writes market/output/{market.json, personas.csv, companies.csv} and copies market.json into the
dashboard. Standard library only. Every name and company is invented.
"""
import argparse
import csv
import json
import math
import random
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FIRST = [
    "Maria", "James", "Aisha", "Wei", "Carlos", "Priya", "Derek", "Fatima", "Tom", "Yuki",
    "Luis", "Grace", "Andre", "Nina", "Omar", "Rachel", "Kofi", "Elena", "Sam", "Hana",
    "Marcus", "Leah", "Raj", "Sofia", "Dmitri", "Tasha", "Ben", "Mei", "Victor", "Alana",
    "Jorge", "Keisha", "Ethan", "Rosa", "Imran", "Claire", "Tyrone", "Ingrid", "Paulo", "Dana",
    "Hector", "Joy", "Kenji", "Amara", "Frank", "Lucia", "Nate", "Zainab", "Owen", "Beatriz",
    "Javier", "Milan", "Clau", "Leo", "Ines", "Tariq", "Mira", "Jonas", "Aiko", "Felix",
]
LAST = [
    "Okafor", "Nguyen", "Ramirez", "Patel", "Kowalski", "Haddad", "Brennan", "Tanaka", "Silva",
    "Johnson", "Cho", "Mensah", "Lindqvist", "Morales", "Fischer", "Abbott", "Reyes", "Sato",
    "Delgado", "Murphy", "Ahmed", "Novak", "Castillo", "Walsh", "Iyer", "Duarte", "Hughes",
    "Banerjee", "Ortiz", "Kim", "Petrov", "Greene", "Alvarez", "Yamamoto", "Osei", "Romero",
    "Becker", "Chavez", "Lund", "Torres", "Vance", "Moreau", "Sorensen", "Achebe", "Park",
]
NAME_A = ["Ember", "Hollow", "Iron", "Moss", "Pixel", "Quarry", "Rook", "Salt", "Thorn", "Vale",
          "Copper", "Drift", "Fable", "Glint", "Harbor", "Lantern", "North", "Oak", "Prism", "Wren"]
NAME_B = ["", "light", "stone", "fall", "wick", "field", "forge", "crest", "gate", "mark", "bound"]
REGIONS = ["US West", "US East", "US Central", "Canada", "UK", "Western Europe", "Nordics", "Japan",
           "Korea", "Southeast Asia", "Australia", "Latin America"]


def allocate(mix, n):
    """Split n items across a weighted mix so the counts match the weights (largest remainder)."""
    total = sum(mix.values())
    raw = {k: n * w / total for k, w in mix.items()}
    counts = {k: math.floor(v) for k, v in raw.items()}
    leftover = n - sum(counts.values())
    for k in sorted(raw, key=lambda k: raw[k] - counts[k], reverse=True)[:leftover]:
        counts[k] += 1
    return counts


def clamp(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


def person(rng, used):
    while True:
        full = f"{rng.choice(FIRST)} {rng.choice(LAST)}"
        if full not in used:
            used.add(full)
            return full


def company_name(rng, segment, ctype, used, owner):
    for _ in range(200):
        if segment["key"] == "amateur":
            name = f"{owner.split()[1]} {rng.choice(ctype['names'])}"
        else:
            name = f"{rng.choice(NAME_A)}{rng.choice(NAME_B)} {rng.choice(ctype['names'])}"
        if name not in used:
            used.add(name)
            return name
    raise RuntimeError("ran out of company names")


def pain_score(pains):
    """Overall pain = mean intensity of the persona's three strongest pain points."""
    vals = sorted((x["intensity"] for x in pains), reverse=True)[:3]
    return sum(vals) / len(vals)


def assign_pain_levels(personas, high_share=0.35, low_share=0.25):
    """Pain level is relative within each segment: top 35% High, bottom 25% Low, rest Medium."""
    for seg in {p["segment"] for p in personas}:
        ranked = sorted((p for p in personas if p["segment"] == seg), key=lambda p: p["pain_score"])
        n = len(ranked)
        for i, p in enumerate(ranked):
            p["pain_level"] = "Low" if i < n * low_share else "High" if i >= n * (1 - high_share) else "Medium"


def pick_pains(rng, role, type_pain, heat, lo_hi):
    """Core pains always apply, plus the company-type pain where one exists. Optional pains are
    sampled until the persona has 3-5. Intensity moves with company heat and individual noise."""
    lo, hi = lo_hi
    chosen = [dict(p, source="role") for p in role.get("core_pains", [])]
    if type_pain:
        chosen.append(dict(type_pain, source="industry"))
    target = rng.randint(lo, hi)
    optional = list(role.get("optional_pains", []))
    rng.shuffle(optional)
    while len(chosen) < target and optional:
        chosen.append(dict(optional.pop(), source="role"))
    chosen = chosen[:hi]
    out = []
    for p in chosen:
        intensity = clamp(p.get("weight", 0.7) * 0.85 + heat * 0.45 + rng.gauss(0, 0.14), 0.05, 0.98)
        out.append({
            "key": p["key"], "label": p["label"], "description": p["description"],
            "tags": p.get("tags", []), "source": p["source"], "intensity": round(intensity, 2),
        })
    out.sort(key=lambda x: x["intensity"], reverse=True)
    return out


def build(config):
    rng = random.Random(config.get("seed", 42))
    n = config["n_companies"]
    lo_hi = tuple(config.get("pains_per_persona", [3, 5]))
    roles = {r["key"]: r for r in config["roles"]}
    segments = config["segments"]
    seg_counts = allocate({s["key"]: s.get("share", 1) for s in segments}, n)

    used_names, used_people = set(), set()
    companies, personas = [], []
    i = 0
    for seg in segments:
        types = [t["label"] for t in seg["types"]]
        type_counts = allocate({t["label"]: t["weight"] for t in seg["types"]}, seg_counts[seg["key"]])
        plan = [t for t in types for _ in range(type_counts[t])]
        rng.shuffle(plan)
        for tlabel in plan:
            ctype = next(t for t in seg["types"] if t["label"] == tlabel)
            i += 1
            trigger = rng.choice(ctype.get("triggers", seg["triggers"]))
            heat = rng.betavariate(2.2, 2.2) - 0.5
            if "nothing urgent" in trigger:
                heat -= 0.2
            members = [(person(rng, used_people), roles[k]) for k in ctype["roles"]]
            lo, hi = ctype.get("employees", seg["employees"])
            employees = lo if lo == hi else int(rng.uniform(lo, hi))
            company = {
                "id": f"C{i:03d}",
                "name": company_name(rng, seg, ctype, used_names, members[0][0]),
                "segment": seg["key"],
                "industry": seg["label"],
                "company_type": tlabel,
                "size_band": seg["size_band"],
                "employees": employees,
                "region": rng.choice(REGIONS),
                "trigger": trigger,
                "current_tool": rng.choice(ctype.get("alternatives", seg["alternatives"])),
            }
            companies.append(company)
            for full, role in members:
                type_pain = config.get("type_pains", {}).get(tlabel, {}).get(role["key"])
                pains = pick_pains(rng, role, type_pain, heat, lo_hi)
                personas.append({
                    "id": f"{company['id']}-{role['key']}",
                    "company_id": company["id"],
                    "company": company["name"],
                    "segment": seg["key"],
                    "industry": seg["label"],
                    "company_type": tlabel,
                    "size_band": seg["size_band"],
                    "employees": employees,
                    "region": company["region"],
                    "name": full,
                    "role": role["key"],
                    "role_label": role["label"],
                    "title": rng.choice(role["titles"]),
                    "buying_role": role["buying_role"],
                    "veto": role.get("veto", False),
                    "stakes": role.get("stakes", 0.5),
                    "years_in_role": rng.randint(1, 15),
                    "skepticism": round(clamp(role["skepticism"] + rng.gauss(0, 0.12), 0.05, 0.95), 2),
                    "change_fatigue": round(clamp(role.get("change_fatigue", 0.5) - heat * 0.2 + rng.gauss(0, 0.12), 0.05, 0.95), 2),
                    "pains": pains,
                    "pain_level": None,
                    "pain_score": round(pain_score(pains), 2),
                    "trigger": trigger,
                    "current_tool": company["current_tool"],
                    "context": role.get("context", ""),
                })
    assign_pain_levels(personas)
    return {
        "market_name": config["market_name"],
        "product_category": config["product_category"],
        "description": config.get("description", ""),
        "seed": config.get("seed", 42),
        "themes": config.get("themes", {}),
        "segments": [{"key": s["key"], "label": s["label"], "size_band": s["size_band"],
                      "roles": sorted({k for t in s["types"] for k in t["roles"]}, key=list(roles).index)}
                     for s in segments],
        "roles": [{k: r.get(k) for k in ("key", "label", "buying_role", "segment", "veto", "stakes")}
                  for r in config["roles"]],
        "competitors": config.get("competitors", []),
        "companies": companies,
        "personas": personas,
    }


def write_outputs(market, outdir):
    outdir.mkdir(parents=True, exist_ok=True)
    (outdir / "market.json").write_text(json.dumps(market, indent=1))
    with open(outdir / "personas.csv", "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "title", "role", "company", "segment", "company_type", "size_band",
                    "buying_role", "veto", "years_in_role", "skepticism", "change_fatigue", "pain_level",
                    "pain_1", "pain_2", "pain_3", "pain_4", "pain_5", "trigger", "current_tool"])
        for p in market["personas"]:
            pains = [f"{x['label']} ({x['intensity']})" for x in p["pains"]] + [""] * 5
            w.writerow([p["id"], p["name"], p["title"], p["role_label"], p["company"], p["industry"],
                        p["company_type"], p["size_band"], p["buying_role"], p["veto"], p["years_in_role"],
                        p["skepticism"], p["change_fatigue"], p["pain_level"], *pains[:5], p["trigger"],
                        p["current_tool"]])
    with open(outdir / "companies.csv", "w", newline="") as f:
        w = csv.writer(f)
        cols = ["id", "name", "industry", "company_type", "size_band", "employees", "region", "trigger", "current_tool"]
        w.writerow(cols)
        for c in market["companies"]:
            w.writerow([c[k] for k in cols])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(ROOT / "market" / "meshy.config.json"))
    ap.add_argument("--out", default=str(ROOT / "market" / "output"))
    ap.add_argument("--no-app-copy", action="store_true", help="don't copy market.json into the dashboard")
    args = ap.parse_args()

    market = build(json.loads(Path(args.config).read_text()))
    write_outputs(market, Path(args.out))
    if not args.no_app_copy:
        app_data = ROOT / "app" / "public" / "data"
        app_data.mkdir(parents=True, exist_ok=True)
        (app_data / "market.json").write_text(json.dumps(market))

    print(f"{market['market_name']}: {len(market['companies'])} companies, {len(market['personas'])} personas")
    print("Companies by segment:", dict(Counter(c["industry"] for c in market["companies"])))
    print("Personas by segment:", dict(Counter(p["industry"] for p in market["personas"])))
    print("Company types:", dict(Counter(c["company_type"] for c in market["companies"])))
    print("Pain levels:", dict(Counter(p["pain_level"] for p in market["personas"])))
    print("Pains per persona:", dict(Counter(len(p["pains"]) for p in market["personas"])))


if __name__ == "__main__":
    main()
