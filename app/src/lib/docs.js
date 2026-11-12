// Read uploaded documents in the browser. Nothing leaves the page until you run an analysis,
// and then only to api.anthropic.com.

export const DOC_TYPES = ['PRD', 'MRD', 'Creative brief', 'Positioning', 'Research', 'Other'];
export const ACCEPT = '.pdf,.docx,.md,.markdown,.txt,.html,.htm';
const MAX_BYTES = 20 * 1024 * 1024;

export function guessType(name, text = '') {
  const s = `${name} ${text.slice(0, 600)}`.toLowerCase();
  if (/\bprd\b|product requirement/.test(s)) return 'PRD';
  if (/\bmrd\b|market requirement/.test(s)) return 'MRD';
  if (/creative brief|\bbrief\b/.test(s)) return 'Creative brief';
  if (/positioning|messaging/.test(s)) return 'Positioning';
  if (/research|interview|survey/.test(s)) return 'Research';
  return 'Other';
}

const words = (t) => (t.match(/\S+/g) ?? []).length;

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body?.innerText ?? doc.body?.textContent ?? '';
}

/** Returns { id, name, type, kind, words?, text?, base64? }. Throws with a readable message. */
export async function readDocument(file) {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is over 20 MB. Split it or export the relevant sections.`);
  const ext = file.name.split('.').pop().toLowerCase();
  const id = `${file.name}-${file.size}-${file.lastModified}`;

  if (ext === 'pdf') {
    const base64 = toBase64(await file.arrayBuffer());
    return { id, name: file.name, type: guessType(file.name), kind: 'PDF', base64, size: file.size };
  }
  if (ext === 'docx') {
    const mammoth = (await import('mammoth/mammoth.browser.js')).default ?? (await import('mammoth/mammoth.browser.js'));
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    const text = value.trim();
    if (!text) throw new Error(`${file.name} has no readable text.`);
    return { id, name: file.name, type: guessType(file.name, text), kind: 'Word', text, words: words(text) };
  }
  if (['md', 'markdown', 'txt', 'html', 'htm'].includes(ext)) {
    let text = await file.text();
    if (ext.startsWith('htm')) text = htmlToText(text);
    text = text.trim();
    if (!text) throw new Error(`${file.name} is empty.`);
    return { id, name: file.name, type: guessType(file.name, text), kind: ext.startsWith('htm') ? 'HTML' : ext === 'txt' ? 'Text' : 'Markdown', text, words: words(text) };
  }
  throw new Error(`${file.name}: use PDF, Word (.docx), Markdown or plain text. For Google Docs, download as .docx or PDF first.`);
}

export function pastedDocument(name, text, type) {
  const t = text.trim();
  return { id: `paste-${Date.now()}`, name: name || 'Pasted text', type: type || guessType(name, t), kind: 'Pasted', text: t, words: words(t) };
}
