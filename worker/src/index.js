/* ============================================================================
   BW CAD Hub — assistant endpoint (Cloudflare Worker)

   Answers questions about the BW BricsCAD tools from THIS site's documentation
   and nothing else. Everything else here is guard rails.

   IT RUNS ON WORKERS AI BY DEFAULT — Cloudflare's own models, called through
   the `AI` binding. That means NO API KEY, no second vendor and no separate
   bill: the model runs on the same platform as this Worker. Swapping to a
   paid provider later is one variable (see PROVIDER below), because the
   quality ceiling of a small open model is the one real cost of this choice.

   WHAT CROSSES THE WIRE: the visitor's question, and the published
   documentation. Nothing about a drawing, a job or a client — the corpus IS the
   public site, which is why this stays a simple, low-stakes service.

   THE CORPUS IS FETCHED, NOT BUNDLED. It lives at
   /assets/data/corpus.json on the docs site, so regenerating it and pushing is
   all it takes to update what the assistant knows — no redeploy of this Worker.
   It is cached in module scope, which survives between requests on a warm
   isolate.
   ========================================================================= */

const CORPUS_URL =
  'https://agabanto.github.io/bw-drafting-docs/assets/data/corpus.json';

/* Origins allowed to call this. The docs site, plus localhost for previewing
   changes before they are published. */
const ALLOWED = [
  'https://agabanto.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000'
];

/* How many documentation sections to send. 0 sends the whole corpus.

   THIS IS A CONTEXT-WINDOW DECISION, not a cost one. The whole corpus is only
   ~28k tokens and sending all of it is strictly better for accuracy — with a
   big-context model (gpt-4o-mini and the like) set this to 0 and stop
   thinking about retrieval.

   Workers AI runs open models with much smaller windows, often 8k, so the
   whole corpus does not fit and sections must be picked. The number matters:
   a dozen was measured against real questions and LOSES answers. "How do I
   label lot areas" did not reach ALAB, because command sections are HEADED by
   the command name, so a plain-English question never matches the heading
   while a page titled "Labelling loaded lots" wins on its title alone.

   40 is the compromise — roughly 4.6k tokens, comfortably inside an 8k window
   even with the system prompt, and wide enough that the right section does not
   have to rank in the top few, only somewhere in the top forty. Raise it if
   the model you pick has room; a wrong answer costs a drafter far more than
   the tokens ever will. */
const DEFAULT_SECTIONS = 40;

const MAX_QUESTION = 400;      // characters; a question, not a pasted document

/* Best-effort per-isolate throttle. This is NOT the real rate limit — isolates
   come and go, so it only blunts a hot loop. Set a proper per-IP rule in the
   Cloudflare dashboard (Security → WAF → Rate limiting); it is free and it is
   what actually protects the key. */
const WINDOW_MS = 60_000;
const PER_WINDOW = 12;
const seen = new Map();

let corpusCache = null;
let dfCache = null;

const STOP = new Set(('a an the and or of to in on for from with by is are was do does did how ' +
  'what when where which that this it its you your i my we our can could should would if then ' +
  'than there here as at be been being have has had not no yes use used using get got make made'
).split(' '));

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return json({ error: 'POST a question' }, 405, cors);
    if (!ALLOWED.includes(origin)) return json({ error: 'Not allowed' }, 403, cors);

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (throttled(ip)) {
      return json({ answer: 'That is a lot of questions at once — give it a minute and try again.' },
                  200, cors);
    }

    let question = '';
    try {
      const body = await request.json();
      question = String(body.question || '').trim();
    } catch { /* falls through to the empty check */ }

    if (!question) return json({ error: 'No question' }, 400, cors);
    if (question.length > MAX_QUESTION) question = question.slice(0, MAX_QUESTION);

    let corpus;
    try {
      corpus = await getCorpus();
    } catch {
      return json({ answer: 'I could not reach the documentation just now. Try again shortly.' },
                  200, cors);
    }

    const limit = Number(env.SECTIONS ?? DEFAULT_SECTIONS);
    const picked = limit > 0 ? search(question, corpus, limit) : corpus;
    if (!picked.length) return json({ answer: NOT_FOUND, sources: [] }, 200, cors);

    try {
      const raw = await askModel(question, picked, env);

      /* The model is told to say exactly this when the docs do not cover it.
         Offering sources for a non-answer would imply they contain something.
         Matched loosely in the opening words rather than at position 0: a
         small model often wraps the token in a sentence, and treating that as
         a real answer would show the reader the literal string NOT_IN_DOCS. */
      if (/NOT_IN_DOCS/.test(raw.slice(0, 60))) {
        return json({ answer: NOT_FOUND, sources: [] }, 200, cors);
      }

      /* Citations come from the model, not from a guess. It ends with
         "SOURCES: 4, 12" naming the sections it actually used, which is the
         only way to link the reader to the paragraph the answer came from
         rather than to whatever a search happened to rank first. */
      const { answer, sources } = splitSources(raw, picked);
      return json({ answer: answer || NOT_FOUND, sources }, 200, cors);
    } catch (e) {
      return json({ answer: 'The assistant is unavailable at the moment. ' +
                            'The documentation is all still here, and the support form works.' },
                  200, cors);
    }
  }
};

const NOT_FOUND =
  'I can only answer from the tool documentation, and I cannot find that in it. ' +
  'If it is about a specific job or drawing I will not be able to help — for ' +
  'anything else, send it through the support form or hit Report a Bug on any ribbon tab.';

/* ---------- the model ---------------------------------------------------- */

async function askModel(question, sections, env) {
  const context = sections
    .map((d, i) => `[${i + 1}] ${d.h || d.t} (${d.u})\n${d.x}`)
    .join('\n\n');

  const system = [
    'You answer questions about the BW BricsCAD Tools for drafters at Beveridge Williams.',
    '',
    'Answer ONLY from the documentation below. Do not use outside knowledge about',
    'AutoCAD, BricsCAD or other software, and never invent a command name, a prompt',
    'or a layer name — a drafter will act on what you say, and a plausible invention',
    'is worse than no answer.',
    '',
    'If the documentation does not cover it, reply with exactly: NOT_IN_DOCS',
    '',
    'Be brief and practical: two or three sentences, or a short numbered list for a',
    'sequence of steps. Name the command in capitals (ALAB, DIMDATA). Write plainly,',
    'the way a colleague would explain it at the next desk.',
    '',
    'End your answer with a line naming the numbered sections you used, like:',
    'SOURCES: 4, 12',
    'Only list sections you actually drew on.'
  ].join('\n');

  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `Documentation:\n\n${context}\n\nQuestion: ${question}` }
  ];

  /* One switch, so changing provider is a wrangler.toml edit and a redeploy
     rather than a code change. Both branches take the same messages and
     return the same plain string; everything downstream is provider-blind. */
  return (env.PROVIDER || 'workers-ai') === 'workers-ai'
    ? runWorkersAi(messages, env)
    : runOpenAiCompatible(messages, env);
}

/* Cloudflare's own models, via the `AI` binding declared in wrangler.toml.
   No key, no fetch, no external host — the call never leaves the platform. */
async function runWorkersAi(messages, env) {
  const out = await env.AI.run(env.MODEL || '@cf/meta/llama-3.1-8b-instruct', {
    messages,
    max_tokens: 400,
    temperature: 0.2             // documentation answers, not creative writing
  });
  return String(out?.response || '').trim();
}

/* OpenAI and Groq speak the SAME wire format, so one function covers both —
   only BASE_URL and the key differ (api.openai.com/v1 vs api.groq.com/openai/v1).
   Google Gemini does NOT: it has its own request and response shape, so it
   would need a third branch here rather than a different URL. */
async function runOpenAiCompatible(messages, env) {
  const base = env.BASE_URL || 'https://api.openai.com/v1';
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.API_KEY}`
    },
    body: JSON.stringify({
      model: env.MODEL || 'gpt-4o-mini',
      max_tokens: 400,
      temperature: 0.2,
      messages
    })
  });

  if (!res.ok) throw new Error('model ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

/* Pulls the model's "SOURCES: 4, 12" line off the end and turns it into links.
   Anything unparseable just means no links - never a broken answer. */
function splitSources(raw, sections) {
  const m = raw.match(/\n?\s*SOURCES:\s*([0-9,\s]+)\s*$/i);
  if (!m) return { answer: raw.trim(), sources: [] };

  const seenUrl = new Set();
  const sources = [];
  for (const part of m[1].split(',')) {
    const i = parseInt(part.trim(), 10);
    const d = sections[i - 1];
    if (!d || seenUrl.has(d.u)) continue;
    seenUrl.add(d.u);
    sources.push({ u: d.u, h: d.h || d.t });
    if (sources.length >= 4) break;
  }
  return { answer: raw.slice(0, m.index).trim(), sources };
}

/* ---------- corpus + retrieval ------------------------------------------- */

async function getCorpus() {
  if (corpusCache) return corpusCache;
  const res = await fetch(CORPUS_URL, { cf: { cacheTtl: 900 } });
  if (!res.ok) throw new Error('corpus ' + res.status);
  corpusCache = await res.json();
  dfCache = null;
  return corpusCache;
}

/* Same scoring as the site's own stub search, so what the model is given
   matches what the page would have shown. Common words are dropped and the
   rest weighted by rarity: a section naming ALAB beats one that says
   "command" forty times. Long sections are damped so they cannot win on
   volume. */
function search(q, corpus, limit) {
  if (!dfCache) {
    dfCache = Object.create(null);
    for (const d of corpus) {
      const words = new Set((d.x + ' ' + (d.h || '')).toLowerCase().match(/[a-z0-9]+/g) || []);
      for (const w of words) dfCache[w] = (dfCache[w] || 0) + 1;
    }
  }
  const n = corpus.length;
  const words = (q.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(w => w.length > 1 && !STOP.has(w));
  if (!words.length) return [];

  const scored = [];
  for (const d of corpus) {
    const hay = d.x.toLowerCase();
    const head = (d.h || '').toLowerCase();
    let score = 0;
    for (const w of words) {
      const idf = Math.log((n + 1) / (1 + (dfCache[w] || 0)));
      if (idf <= 0.5) continue;
      if (head.includes(w)) score += 8 * idf;
      let at = 0, hits = 0;
      while ((at = hay.indexOf(w, at)) >= 0 && hits < 4) { hits++; at += w.length; }
      score += hits * idf;
    }
    if (score > 0) scored.push({ d, s: score / Math.sqrt(Math.max(d.x.length, 600) / 600) });
  }
  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(x => x.d);
}

/* ---------- plumbing ------------------------------------------------------ */

function throttled(ip) {
  const now = Date.now();
  const hits = (seen.get(ip) || []).filter(t => now - t < WINDOW_MS);
  hits.push(now);
  seen.set(ip, hits);
  if (seen.size > 2000) seen.clear();       // this is a cache, not a ledger
  return hits.length > PER_WINDOW;
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors }
  });
}
