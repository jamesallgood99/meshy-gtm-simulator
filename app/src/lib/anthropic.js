// Minimal Claude API client that runs in the browser. The key goes straight from the browser to
// api.anthropic.com and nowhere else. The direct-browser-access header is required for CORS.

export const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (recommended)' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, cheapest)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callClaude({ apiKey, model, system, messages, tools, toolChoice, maxTokens = 4096, signal }) {
  const body = { model, max_tokens: maxTokens, system, messages };
  if (tools) body.tools = tools;
  if (toolChoice) body.tool_choice = toolChoice;

  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 3) {
      await sleep(1500 * 2 ** attempt);
      continue;
    }
    let detail = '';
    try {
      detail = (await res.json())?.error?.message ?? '';
    } catch { /* ignore */ }
    if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings.');
    if (res.status === 404) throw new Error(`Model "${model}" wasn't found. Pick another model in Settings.`);
    throw new Error(`Claude API error ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  throw new Error('The Claude API is busy. Try again in a minute.');
}

export function toolInput(response, name) {
  const block = response.content?.find((b) => b.type === 'tool_use' && b.name === name);
  if (!block) throw new Error('The model did not return structured results. Try again.');
  return block.input;
}

export function text(response) {
  return response.content?.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim() ?? '';
}

/** Run async jobs with limited concurrency. */
export async function pool(jobs, concurrency, onDone) {
  const results = new Array(jobs.length);
  let next = 0;
  async function worker() {
    while (next < jobs.length) {
      const i = next++;
      results[i] = await jobs[i]();
      onDone?.(i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}
