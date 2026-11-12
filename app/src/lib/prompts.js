// The prompts are the method. They're mirrored in skill/gtm-simulator/references/personas-and-prompts.md
// so the Claude skill and the dashboard behave the same way.

export const HONESTY_RULES = `You are simulating real buyers, not cheering for the vendor.
- Be honest, not flattering. Most marketing copy lands flat with most people. A realistic panel centers in the 40s and 50s.
- React from each persona's pains, trigger, role stakes and skepticism, never from the quality of the writing.
- Skeptical personas need proof inside the message (a number, a customer, a mechanism) to score above 60.
- Change fatigue (a trait from 0 to 1) is resistance: anything that sounds like a new rollout, a new login or more oversight loses points with those personas.
- Role stakes override pain. An artist may resist anything that sounds like replacing artists or training on their work. Legal and InfoSec may resist any claim about IP or data they can't verify. A buyer on a personal card may resist anything that sounds like a billing trap.
- Each persona already has a current tool or alternative. Judge the message against what they use today, not against nothing.
- Write reactions in the persona's own voice: short, specific, plain. No marketing language.`;

export const RUBRIC = `Interest score (0-100) = how likely this persona is to take a next step after reading the message cold in a busy week.
85-100 urgent fit, replies today | 70-84 strong interest, takes the meeting | 55-69 curious, needs proof | 40-54 indifferent | 25-39 skeptical | 0-24 negative, raises a red flag.
Confidence: high = clearly hits or misses their top pains; medium = touches them indirectly; low = hard to tell.`;

export const painList = (p) => p.pains.map((x) => `${x.label} (${x.intensity})`).join('; ');

export function personaCard(p) {
  return `[${p.id}] ${p.name}, ${p.title} (${p.role_label}; ${p.buying_role}) at ${p.company}, ${p.company_type ?? p.industry} (${p.industry}), ${p.size_band} employees. ` +
    `Skepticism ${p.skepticism}, change fatigue ${p.change_fatigue}. Pain points, intensity 0-1: ${painList(p)}. Right now: ${p.trigger}.` +
    `${p.current_tool ? ` Uses today: ${p.current_tool}.` : ''} Role context: ${p.context}`;
}

export function scoreSystem(market) {
  return `You run a synthetic market of buyers for: ${market.product_category}.

${HONESTY_RULES}

${RUBRIC}

Score every persona you are given. Each persona reacts independently; do not let one persona's view influence another's.`;
}

export function scoreUser({ message, variantName, product, context, personas }) {
  const lead = context ? `Context: ${context}\n\n` : product ? `What the company sells: ${product}\n\n` : '';
  return `${lead}Message being tested${variantName ? ` (${variantName})` : ''}:
"""
${message}
"""

Personas:
${personas.map((p) => personaCard(p)).join('\n')}

Record a score for every persona with the record_scores tool.`;
}

export const SCORE_TOOL = {
  name: 'record_scores',
  description: 'Record each persona\'s reaction to the message.',
  input_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            persona_id: { type: 'string' },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            reaction: { type: 'string', description: 'One or two sentences in the persona\'s own voice.' },
            objection: { type: 'string', description: 'The single thing that would stop them, in a few words.' },
          },
          required: ['persona_id', 'score', 'confidence', 'reaction', 'objection'],
        },
      },
    },
    required: ['results'],
  },
};

export function talkSystem(persona, product) {
  return `You are ${persona.name}, ${persona.title} at ${persona.company} (${persona.company_type ?? persona.industry}, ${persona.size_band} employees).
Your role in a purchase like this: ${persona.buying_role}. ${persona.context}
What's going on right now: ${persona.trigger}.
${persona.current_tool ? `What you use today instead: ${persona.current_tool}.
` : ''}What keeps you up at night, and how much it bites (0-1):
${persona.pains.map((x) => `- ${x.label} (${x.intensity}): ${x.description}`).join('\n')}
Your strongest pains come up first and loudest. A pain under 0.4 barely registers unless the vendor raises it.
Your skepticism toward vendors: ${persona.skepticism} (0 trusting, 1 very skeptical). Your patience for new tools and rollouts is low when change fatigue is high: ${persona.change_fatigue}. You've been in this role ${persona.years_in_role} years.
${product ? `A vendor is pitching you: ${product}.` : 'A vendor is pitching you.'}

Stay in character. Talk like a real person on a short call: two to five sentences, plain words, no bullet points.
Be honest, not polite. Push back on vague claims and ask for proof, price, integration effort and who else uses it, but only where your role and pains would make you care.
If something genuinely solves one of your top problems, say so. If it doesn't, say that too.
Never mention that you are an AI or a simulation.`;
}

export function stressSystem(market) {
  return `You run a synthetic market of buyers for: ${market.product_category}.
You are convening the toughest critics in the market to attack one claim. Each critic attacks from their own role, pains and stakes.

${HONESTY_RULES}

Attacks are specific and grounded: what the critic doubts, why, and what they'd say in the meeting. Severity 1-5, where 5 means this objection alone kills the deal.`;
}

export function stressUser({ claim, product, personas }) {
  return `${product ? `What the company sells: ${product}\n\n` : ''}Claim under attack:
"""
${claim}
"""

Critics:
${personas.map((p) => personaCard(p)).join('\n')}

Record every critic's attack, then rewrite the claim so it survives the most severe one, with the record_attacks tool.`;
}

export const STRESS_TOOL = {
  name: 'record_attacks',
  description: 'Record each critic\'s attack on the claim and a rewrite that survives them.',
  input_schema: {
    type: 'object',
    properties: {
      attacks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            persona_id: { type: 'string' },
            attack: { type: 'string', description: 'Two or three sentences in the critic\'s own voice.' },
            severity: { type: 'integer', minimum: 1, maximum: 5 },
            evidence_needed: { type: 'string', description: 'What proof would neutralize this attack.' },
          },
          required: ['persona_id', 'attack', 'severity', 'evidence_needed'],
        },
      },
      rewrite: { type: 'string', description: 'The claim, narrowed or proven until it survives the top attack.' },
      rewrite_rationale: { type: 'string' },
    },
    required: ['attacks', 'rewrite', 'rewrite_rationale'],
  },
};

// ---------------------------------------------------------------------------------------------
// Documents → brief → messaging
// ---------------------------------------------------------------------------------------------

export const THEME_KEYS = ['cost', 'speed', 'quality', 'pipeline', 'ip', 'privacy', 'credits', 'craft', 'jobs', 'compliance', 'support', 'differentiation', 'revenue', 'change'];

export function extractSystem(market) {
  const roles = market.roles.map((r) => `${r.key} (${r.label}; ${r.buying_role})`).join(', ');
  return `You are a product marketing lead reading a launch's source documents: PRDs, MRDs, creative briefs and anything else the team uploaded.
Pull out exactly what the documents say. Do not invent features, numbers, customers or proof. If a document doesn't say something, leave it out.

The market you are preparing for: ${market.market_name}, buying ${market.product_category}.
Buying roles in this market: ${roles}.
Theme tags you may use: ${THEME_KEYS.join(', ')}.

For each feature, name the roles who would use it day to day (primary_roles, using the role keys above), tag it with themes from the list, and rate setup effort for the customer (low, medium, high) from what the documents say about deployment.
For each marketing claim, record the proof the documents give for it and rate proof strength 1-5: 1 = no proof, 2 = anecdote or in progress, 3 = small pilot or internal analysis, 4 = measured across most deployments, 5 = independent or large-sample evidence.
From any creative brief, capture the tone, the proposition and every mandatory.`;
}

export const EXTRACT_TOOL = {
  name: 'record_brief',
  description: 'Record what the source documents say about the product, its features, its claims and the creative guardrails.',
  input_schema: {
    type: 'object',
    properties: {
      product_name: { type: 'string' },
      summary: { type: 'string', description: 'Two or three plain sentences: what it is, who it is for, what it does.' },
      target: { type: 'string', description: 'Who the documents say the customer is.' },
      proposition: { type: 'string', description: 'The single-minded proposition, if a brief gives one. Otherwise the documents\' core promise.' },
      tone: { type: 'string' },
      mandatories: { type: 'array', items: { type: 'string' } },
      features: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'F1, F2, ...' },
            name: { type: 'string' },
            short: { type: 'string', description: 'Two or three words, for table headers.' },
            description: { type: 'string', description: 'One sentence.' },
            primary_roles: { type: 'array', items: { type: 'string' } },
            themes: { type: 'array', items: { type: 'string', enum: THEME_KEYS } },
            setup_effort: { type: 'string', enum: ['low', 'medium', 'high'] },
            source: { type: 'string', description: 'Which document it came from.' },
          },
          required: ['id', 'name', 'short', 'description', 'primary_roles', 'themes', 'setup_effort', 'source'],
        },
      },
      claims: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'K1, K2, ...' },
            text: { type: 'string' },
            proof: { type: 'string', description: 'What the documents offer as proof, or "None stated".' },
            proof_strength: { type: 'integer', minimum: 1, maximum: 5 },
            theme: { type: 'string', enum: THEME_KEYS },
            source: { type: 'string' },
          },
          required: ['id', 'text', 'proof', 'proof_strength', 'theme', 'source'],
        },
      },
    },
    required: ['product_name', 'summary', 'target', 'proposition', 'tone', 'mandatories', 'features', 'claims'],
  },
};

export function docsUserContent(docs) {
  // Text documents go inline. PDFs go as document blocks, which the Claude API reads natively.
  const blocks = [];
  for (const d of docs) {
    if (d.base64) {
      blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: d.base64 }, title: `${d.type}: ${d.name}` });
    } else {
      blocks.push({ type: 'text', text: `<document type="${d.type}" name="${d.name}">\n${d.text}\n</document>` });
    }
  }
  blocks.push({ type: 'text', text: 'Read every document above, then record the brief with the record_brief tool.' });
  return blocks;
}

export function messagesSystem(market) {
  return `You write launch messaging for ${market.product_category}, in the voice the creative brief asks for.
Rules:
- Use only features and claims from the brief you are given. A claim with proof strength 1 or 2 may not appear as a fact.
- Follow every mandatory. If two mandatories conflict, follow the stricter one and say so in the rationale.
- Write three distinct directions that a real team would argue about. If the brief names directions, use them. Otherwise aim each at a different buying role and theme.
- Each message is a headline plus one or two sentences, under 40 words total. Plain words. No hype, no exclamation marks.
- Say which features and claims each direction draws on, and which mandatories it checks.`;
}

export function messagesUser(brief, count = 3) {
  return `Brief:\n${JSON.stringify(brief, null, 1)}\n\nWrite ${count} message directions with the record_messages tool.`;
}

export const MESSAGES_TOOL = {
  name: 'record_messages',
  description: 'Record the message directions.',
  input_schema: {
    type: 'object',
    properties: {
      variants: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            headline: { type: 'string' },
            message: { type: 'string', description: 'The full message personas will read, starting with the headline.' },
            focus: { type: 'string', description: 'The angle, in a few words.' },
            rationale: { type: 'string', description: 'One or two sentences: which direction, which reader, why.' },
            features: { type: 'array', items: { type: 'string' }, description: 'Feature ids used.' },
            claims: { type: 'array', items: { type: 'string' }, description: 'Claim ids used.' },
            checks: { type: 'array', items: { type: 'string' }, description: 'Mandatories this direction satisfies, in a few words each.' },
          },
          required: ['headline', 'message', 'focus', 'rationale', 'features', 'claims', 'checks'],
        },
      },
    },
    required: ['variants'],
  },
};

// ---------------------------------------------------------------------------------------------
// Adoption: personas × features
// ---------------------------------------------------------------------------------------------

export function adoptSystem(market) {
  return `You run a synthetic market of buyers for: ${market.product_category}.
You are estimating how each persona would take to each feature of a product after it launches at their company.

${HONESTY_RULES}

For every persona and every feature, record:
- enthusiasm (0-100): how much this persona wants this feature, from their own pains, role and stakes. Most features matter to one or two roles and leave the rest indifferent.
- adopt_90d (0-100): the chance they are actively using it 90 days after launch. For a feature they wouldn't use day to day, the chance they actively back it: approve it, sponsor it, expect it in their reports.
- adopt_12m (0-100): the same, 12 months after launch.
Think about the gap between the two. Novelty fades (anything that needs a new habit, one-off curiosity). Value that compounds grows (a shared asset library, pipeline integrations, a credential that clients ask for). Setup effort and change fatigue slow early adoption. Distrust (fear for artists' jobs, IP and training-data worries, billing surprises) caps both.
- note: one short sentence in the persona's own voice about this feature.`;
}

export function adoptUser({ product, features, personas }) {
  const fl = features.map((f) => `[${f.id}] ${f.name}: ${f.description} Setup effort: ${f.setup_effort}. Built for: ${f.primary_roles.join(', ')}.`).join('\n');
  return `${product ? `Product: ${product}\n\n` : ''}Features:\n${fl}\n\nPersonas:\n${personas.map((p) => personaCard(p)).join('\n')}\n\nRecord one row per persona per feature (${personas.length * features.length} rows) with the record_adoption tool.`;
}

export const ADOPT_TOOL = {
  name: 'record_adoption',
  description: 'Record each persona\'s enthusiasm and adoption for each feature.',
  input_schema: {
    type: 'object',
    properties: {
      rows: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            persona_id: { type: 'string' },
            feature_id: { type: 'string' },
            enthusiasm: { type: 'integer', minimum: 0, maximum: 100 },
            adopt_90d: { type: 'integer', minimum: 0, maximum: 100 },
            adopt_12m: { type: 'integer', minimum: 0, maximum: 100 },
            note: { type: 'string' },
          },
          required: ['persona_id', 'feature_id', 'enthusiasm', 'adopt_90d', 'adopt_12m', 'note'],
        },
      },
    },
    required: ['rows'],
  },
};

// ---- Competition ----

/** Context for a blind head-to-head: personas know the category and the capability, not the brand. */
export function competitionProduct(feature) {
  return `A vendor in this category, describing one capability: ${feature.name}. The vendor's name is hidden. Judge the message as written, the way you'd react to it on a website or in a cold email.`;
}

export function mapCompetitorSystem(market) {
  return `You help a product marketer compare their messaging with a competitor's, capability by capability, in this market: ${market.product_category}.

You get the competitor's own copy (website pages, a deck, ads, a battlecard) and a list of the marketer's features.
For each feature, find what the competitor says about the same capability.
- Use the competitor's words. Quote them, or trim and join their sentences into one or two. Never add a claim, number or benefit they didn't state.
- Skip any feature their copy doesn't address. A missing message is a finding, so don't stretch to fill it.
- Write a one-sentence summary of how they position themselves overall.`;
}

export function mapCompetitorUser({ name, text, features }) {
  return `Competitor: ${name}

Our features:
${features.map((f) => `[${f.id}] ${f.name}: ${f.description}`).join('\n')}

Their copy:
"""
${text.slice(0, 60000)}
"""

Record what they say with the record_competitor_messages tool.`;
}

export const MAP_COMPETITOR_TOOL = {
  name: 'record_competitor_messages',
  description: 'Record the competitor\'s positioning and their message for each matching feature.',
  input_schema: {
    type: 'object',
    properties: {
      positioning: { type: 'string', description: 'One sentence on how they position themselves.' },
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            feature_id: { type: 'string' },
            message: { type: 'string', description: 'Their message for this capability, in their words. One or two sentences.' },
          },
          required: ['feature_id', 'message'],
        },
      },
    },
    required: ['positioning', 'messages'],
  },
};
