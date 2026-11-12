#!/usr/bin/env python3
"""Write app/public/data/demo/meshy.json: the preloaded brief, campaign and competitor messages
from the Meshy MRD and creative brief. Nothing in it is scored."""
import json, re
from pathlib import Path
R = Path(__file__).resolve().parent.parent
cfg = json.loads((R/'market/meshy.config.json').read_text())

brief = {
 "product_name": "Meshy",
 "summary": "Meshy is an AI 3D generation platform. It turns a sketch, photo or prompt into a textured, rigged, print-ready model in about a minute, sends it into Blender, Unity, Unreal or a slicer, and offers an API, a shared studio workspace and enterprise controls. The SMB push adds a free Meshy Certified program and an AI outreach agent, Myko.",
 "target": "Net-new SMB customers across four equally weighted segments: amateurs, individual pros and startups (including print and e-commerce shops), SMB game studios of 10 to 200 people, and large studios and publishers.",
 "proposition": "Base meshes in minutes, finished in your tools, and every model stays yours.",
 "tone": "Plain, specific and respectful of craft. Talk like a technical artist who has shipped games, not like an AI company. Confident, never hyped. No exclamation marks.",
 "mandatories": [
  "Never imply replacing artists, cutting headcount or beating a human modeler.",
  "Promise a hybrid pipeline, never one-click final assets.",
  "Only use claims with proof in the MRD; the blind test, user counts and the 4.7 rating stay out.",
  "Include at least one trust line in every direction: ownership, private by default, or opt out of training.",
  "Never disparage Tripo, Rodin or Hunyuan3D by name."
 ],
 "features": [
  {"id":"F1","name":"Image and text to 3D","short":"Image to 3D","description":"Textured models from a sketch, photo or prompt in about a minute.","primary_roles":["maker","hobby_dev","student","solo_dev","freelancer","startup_founder","print_shop"],"themes":["speed","quality"],"setup_effort":"low","source":"MRD"},
  {"id":"F2","name":"Rigging and animation","short":"Rigging","description":"Auto-rigging and 600+ animations in the same tool.","primary_roles":["solo_dev","hobby_dev","art_director"],"themes":["speed","pipeline"],"setup_effort":"low","source":"MRD"},
  {"id":"F3","name":"Print-ready export","short":"Print-ready","description":"Watertight, slicer-ready models sent straight to Bambu Studio or OrcaSlicer.","primary_roles":["maker","print_shop"],"themes":["quality","pipeline"],"setup_effort":"low","source":"MRD"},
  {"id":"F4","name":"Engine and DCC plugins","short":"Plugins","description":"Send models into Blender, Unity, Unreal, Godot, Maya and Roblox Studio.","primary_roles":["tech_artist","solo_dev","art_director","env_artist"],"themes":["pipeline"],"setup_effort":"medium","source":"MRD"},
  {"id":"F5","name":"API and MCP for agents","short":"API and MCP","description":"Generate and refine from Claude Code, Codex, Cursor or a custom pipeline.","primary_roles":["agent_builder","cto"],"themes":["pipeline","speed"],"setup_effort":"medium","source":"MRD"},
  {"id":"F6","name":"Studio workspace","short":"Workspace","description":"Shared seats and credits, private by default, with an admin switch to opt out of model training.","primary_roles":["art_director","studio_head","producer"],"themes":["privacy","cost"],"setup_effort":"low","source":"MRD"},
  {"id":"F7","name":"Enterprise controls","short":"Enterprise","description":"SAML SSO, SOC 2 and ISO 27001, customer-set retention, and training exclusion by contract.","primary_roles":["legal","infosec","procurement","cto"],"themes":["compliance","ip","privacy"],"setup_effort":"high","source":"MRD"},
  {"id":"F8","name":"Meshy Certified program","short":"Certification","description":"A free 60 to 90 minute course and practical exam; agencies and print shops with two certified staff become Certified Partners.","primary_roles":["env_artist","freelancer","print_shop","senior_artist"],"themes":["craft","differentiation"],"setup_effort":"low","source":"MRD"}
 ],
 "claims": [
  {"id":"K1","text":"Studios get usable models 98% faster.","proof":"Jupiter case study.","proof_strength":3,"theme":"speed","source":"MRD"},
  {"id":"K2","text":"Studios cut asset cost by 80%.","proof":"Thorns Tavern case study.","proof_strength":3,"theme":"cost","source":"MRD"},
  {"id":"K3","text":"30 to 40% less high-poly cleanup work.","proof":"37 Interactive case study.","proof_strength":3,"theme":"quality","source":"MRD"},
  {"id":"K4","text":"Trained only on licensed data.","proof":"Stated on Meshy's enterprise page.","proof_strength":4,"theme":"ip","source":"MRD"},
  {"id":"K5","text":"Your work stays yours, and you can opt out of training on any plan, even free.","proof":"Meshy licence docs and data FAQ.","proof_strength":4,"theme":"privacy","source":"MRD"},
  {"id":"K6","text":"Audited to SOC 2 and ISO 27001.","proof":"SOC 2 and ISO 27001 reports.","proof_strength":5,"theme":"compliance","source":"MRD"},
  {"id":"K7","text":"Print-ready on the first try, up to 97% of the time.","proof":"Up to 97% slicer success rate, 3D Agent launch.","proof_strength":3,"theme":"quality","source":"MRD"},
  {"id":"K8","text":"Used by Nexon, Supercell, Square Enix and DNEG.","proof":"Logos on the enterprise page.","proof_strength":4,"theme":"differentiation","source":"MRD"},
  {"id":"K9","text":"Artists prefer Meshy over the leading rival in a blind test.","proof":"A reseller cites a 1,331-artist test (63.8%); Meshy hasn't published it.","proof_strength":2,"theme":"quality","source":"MRD"},
  {"id":"K10","text":"Production-ready, one-click final assets.","proof":"None stated. Users report topology and cleanup work.","proof_strength":1,"theme":"quality","source":"MRD"},
  {"id":"K11","text":"Fast, human support.","proof":"None stated. 8% of negative reviews got a reply, median 71 days.","proof_strength":1,"theme":"support","source":"MRD"}
 ]
}

campaign = {
 "name": "Meshy SMB launch",
 "product": brief["summary"],
 "variants": [
  {"id":"A","name":"Variant A","headline":"Base meshes in minutes, inside your existing pipeline.",
   "message":"Base meshes in minutes, inside your existing pipeline. Send props straight into Blender, Unity or Unreal and finish them your way. Jupiter got usable models 98% faster. Your models stay private and yours.",
   "focus":"Pipeline: capability and speed","rationale":"Creative brief direction 1. For the art director, tech artist and solo dev. Leads with the hybrid pipeline and the strongest studio proof.","features":["F1","F4"],"claims":["K1","K5"],"checks":["Hybrid pipeline, not one-click","Trust line: private and yours"]},
  {"id":"B","name":"Variant B","headline":"Your models. Your IP. Your call.",
   "message":"Your models. Your IP. Your call. Meshy is trained only on licensed data, keeps your work private by default, and lets you opt out of training on any plan, even free. Base meshes in minutes, finished in your tools.",
   "focus":"Control: trust and ownership","rationale":"Creative brief direction 2. For the studio head, the artist and anyone who has read a one-star review. Trust leads, capability follows.","features":["F6","F7"],"claims":["K4","K5"],"checks":["Trust line: licensed data, opt out","Hybrid pipeline"]},
  {"id":"C","name":"Variant C","headline":"You give it life. Meshy builds the form.",
   "message":"You give it life. Meshy builds the form. Rough out props and characters in minutes, then spend your hours on the details that make the work yours. Get Meshy Certified free, and keep every model you make.",
   "focus":"Craft: pride and certification","rationale":"Creative brief direction 3. For artists, freelancers and shop owners. Puts authorship with the artist and offers the certification as the next step.","features":["F1","F8"],"claims":["K5"],"checks":["Never implies replacing artists","Trust line: keep every model"]}
 ]
}

ids = {"Tripo AI":"tripo","Hyper3D Rodin":"rodin","Tencent Hunyuan3D":"hunyuan","Google Antigravity":"antigravity"}
ours = {
 "F1":"Turn a sketch, photo or prompt into a textured model in about a minute, then finish it in the tools you already use.",
 "F2":"Auto-rig your character and pick from 600+ animations without leaving Meshy.",
 "F3":"Watertight, slicer-ready models sent straight to Bambu Studio or OrcaSlicer, print-ready on the first try up to 97% of the time.",
 "F4":"Send models straight into Blender, Unity, Unreal, Godot, Maya or Roblox Studio. 37 Interactive cut high-poly work by 30 to 40%.",
 "F5":"Give your agent a 3D skill. Generate and refine models from Claude Code, Codex, Cursor or your own pipeline through the API and MCP.",
 "F6":"Shared seats and credits for your team, private by default, with one admin switch to keep your work out of model training.",
 "F7":"Trained only on licensed data. Never trained on yours, by contract. SSO, retention you set, and SOC 2 and ISO 27001 reports.",
}
messages = {f: {"ours": m} for f, m in ours.items()}
for c in cfg["competitors"]:
    for fid, m in c["messages"].items():
        messages.setdefault(fid, {"ours": ours.get(fid, "")})[ids[c["name"]]] = m
competition = {
 "competitors":[{"id":ids[c["name"]],"name":c["name"],"positioning":c["positioning"],"source":"Their own site copy, from the messaging teardown (Nov 9, 2026)"} for c in cfg["competitors"]],
 "features": list(ours.keys()),
 "messages": messages,
 "sample_ids": [],
 "results": {}
}
demo = {
 "generated_by": "hand-authored from the Meshy MRD and creative brief",
 "note": "Nothing here is scored. Add a Claude API key to run the market live.",
 "campaign": campaign, "results": {}, "sample_ids": [], "stress": None, "talk": None,
 "brief": brief,
 "documents": [
  {"name":"meshy-mrd.md","type":"MRD","path":"data/samples/meshy-mrd.md"},
  {"name":"meshy-creative-brief.md","type":"Creative brief","path":"data/samples/meshy-creative-brief.md"}
 ],
 "adoption": None,
 "competition": competition
}
# sanity: role keys
roles = {r["key"] for r in cfg["roles"]}
for f in brief["features"]:
    assert set(f["primary_roles"]) <= roles, f
(R/'app/public/data/demo/meshy.json').write_text(json.dumps(demo, indent=1))
print("ok", len(json.dumps(demo)))
