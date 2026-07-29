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

/* How many earlier turns travel with a question. This is what makes it a
   CONVERSATION rather than a search box that talks: without it, "what about
   arcs?" is unanswerable and the thing feels like a bot no matter how warmly
   it is worded. Six is roughly three exchanges — enough to follow a train of
   thought, short enough that an old topic does not haunt the retrieval. */
const MAX_HISTORY = 6;

/* Best-effort per-isolate throttle. This is NOT the real rate limit — isolates
   come and go, so it only blunts a hot loop. Set a proper per-IP rule in the
   Cloudflare dashboard (Security → WAF → Rate limiting); it is free and it is
   what actually protects the key. */
const WINDOW_MS = 60_000;
const PER_WINDOW = 12;
const seen = new Map();

let corpusCache = null;
let dfCache = null;

/* CONVERSATION, not documentation.

   "hi" is not a question about ALAB, and answering it with the not-in-docs
   refusal reads like a vending machine — which is exactly the first thing
   anyone does when they meet a chat box. Same for "thanks", and same for
   "what can you do", which the bot could not answer at all because nothing
   ever told it what it was.

   These turns skip retrieval entirely: no corpus, no sources, no neurons
   spent shipping 40 documentation sections so it can say good morning. They
   still go to the MODEL rather than a canned string, because a fixed reply
   is charming once and obviously scripted by the third time. */
const GREETING = new RegExp(
  '^\\s*(?:(?:hi|hey+|hello|yo|hiya|howdy|sup|g\'?day|greetings|' +
  'good\\s+(?:morning|afternoon|evening|day)|mornin[g\']?|' +
  'thanks?|thank\\s+you|ta|cheers|nice\\s+one|' +
  'bye|goodbye|see\\s+ya|later|cya)[\\s,!.]*)+' +
  '(?:there|mate|mates|team|guys|folks|all|everyone)?[\\s!?.]*$', 'i');

const META = new RegExp(
  '^\\s*(?:' +
  'who\\s+(?:are|r)\\s+(?:you|u)|' +
  'what\\s+(?:are|r)\\s+(?:you|u)|' +
  'what\\s+(?:can|do)\\s+(?:you|u)\\s+do|' +
  'what\\s+do\\s+(?:you|u)\\s+know|' +
  'how\\s+(?:are|r)\\s+(?:you|u)|' +
  'are\\s+(?:you|u)\\s+(?:a\\s+)?(?:bot|ai|robot|human|real|chatgpt)|' +
  'help|what\\s+is\\s+this' +
  ')\\b[\\s\\S]{0,25}$', 'i');

function looksSocial(q) {
  return GREETING.test(q) || META.test(q);
}

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
      return json({ answer: 'Steady on — that is a lot of questions in a very short time. ' +
                            'Give it a minute and I will still be here.' },
                  200, cors);
    }

    let question = '';
    let history = [];
    try {
      const body = await request.json();
      question = String(body.question || '').trim();
      history = cleanHistory(body.history);
    } catch { /* falls through to the empty check */ }

    if (!question) return json({ error: 'No question' }, 400, cors);
    if (question.length > MAX_QUESTION) question = question.slice(0, MAX_QUESTION);

    /* Small talk never touches the documentation: no corpus fetch, no
       retrieval, no sources. Answering "hi" by shipping 40 sections of
       reference material was both wasteful and, judging by the reply it
       produced, not much of a hello. */
    if (looksSocial(question)) {
      try {
        return json({ answer: await askSocial(question, history, env), sources: [] }, 200, cors);
      } catch (e) {
        console.error('askSocial failed:', e && (e.stack || e.message || e));
        return json({ answer: 'Hello. Ask me anything about the BW BricsCAD Tools.' }, 200, cors);
      }
    }

    let corpus;
    try {
      corpus = await getCorpus();
    } catch {
      return json({ answer: 'I could not reach the documentation just now. Try again shortly.' },
                  200, cors);
    }

    /* Retrieval reads the PREVIOUS question too, because a follow-up is
       usually unsearchable on its own — "what about arcs?" has nothing in it
       to match. Only the previous user turn: any more and old topics start
       dragging the results away from what is being asked now. */
    const prev = [...history].reverse().find(m => m.role === 'user');
    const query = prev ? prev.text + ' ' + question : question;

    const limit = Number(env.SECTIONS ?? DEFAULT_SECTIONS);
    const picked = limit > 0 ? search(query, corpus, limit) : corpus;
    if (!picked.length) return json({ answer: NOT_FOUND, sources: [] }, 200, cors);

    try {
      const raw = await askModel(question, picked, history, env);

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
      /* The reader gets a calm sentence; the operator needs the actual reason.
         Without this the first bad model name looked identical to an outage.
         Visible with `wrangler tail`. */
      console.error('askModel failed:', e && (e.stack || e.message || e));
      return json({ answer: 'Something has broken at my end — your end is fine, for once. ' +
                            'The documentation is all still there, and the support form still works.' },
                  200, cors);
    }
  }
};

/* The refusal is where personality is FREE: it is a fixed string, so it cannot
   hallucinate, and it is the moment the reader is most likely to be annoyed.
   Better it sounds like a colleague admitting the limit than a form letter. */
const NOT_FOUND =
  'That one is not in the documentation, and I would rather say so than make ' +
  'something up — an invented command name would waste far more of your time ' +
  'than this sentence just did. If it is about a specific job or drawing, I know ' +
  'nothing about those and never will. For anything else, the support form or ' +
  'Report a Bug on any ribbon tab will get you a human.';

/* ---------- the model ---------------------------------------------------- */

/* Turns the browser's transcript into something safe to forward: user/assistant
   only, trimmed, capped both in number and in size. It arrives from the client
   and is therefore untrusted — a long enough "history" would otherwise be a
   free way to push whatever you liked into the prompt. */
function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.text)
    .map(m => ({ role: m.role, text: String(m.text).slice(0, 600).trim() }))
    .filter(m => m.text)
    .slice(-MAX_HISTORY);
}

async function askModel(question, sections, history, env) {
  const context = sections
    .map((d, i) => `[${i + 1}] ${d.h || d.t} (${d.u})\n${d.x}`)
    .join('\n\n');

  /* Two halves, and the order matters: the rules bind, the voice decorates.
     Personality was asked for and is genuinely wanted — but a charming answer
     that invents a command name sends a drafter off to type it, so the facts
     are fenced off from the fun explicitly rather than hoped about. */
  const system = [
    'You are the BW CAD Hub assistant. You answer questions about the BW BricsCAD',
    'Tools for drafters at Beveridge Williams.',
    '',
    '=== THE RULES (these are not negotiable) ===',
    '',
    'Answer ONLY from the documentation below. Do not use outside knowledge about',
    'AutoCAD, BricsCAD or other software, and NEVER invent a command name, a prompt,',
    'a layer name or a number — a drafter will act on what you say, and a plausible',
    'invention is worse than no answer. Being funny is never a reason to be vague:',
    'if you are not sure, the joke is not worth it.',
    '',
    'If the documentation does not cover it, reply with exactly: NOT_IN_DOCS',
    '',
    '=== THE VOICE ===',
    '',
    'You are the senior drafter everyone actually likes asking: dry, warm, and quietly',
    'amused by how many ways there are to stuff up a drawing. You have seen all of them.',
    'You are never sarcastic AT the person asking — the joke is about the software, the',
    'file, or the situation, never about them for not knowing.',
    '',
    'Keep the wit in the DELIVERY and out of the FACTS. Command names, layer names,',
    'prompts and numbers are reported exactly and plainly. Flavour the sentence around',
    'them, never the thing itself.',
    '',
    'Give every answer exactly ONE light touch — an aside, an understatement, a knowing',
    'remark about the software. One. Not none, which is just a manual with extra steps;',
    'not three, which is exhausting by the fifth question, and people ask this thing all',
    'day. Usually it sits best in the first clause or the last.',
    '',
    'Australian office register: plain, direct, no corporate padding, no exclamation',
    'marks, no "Great question!".',
    '',
    'NEVER open by restating the question. Banned openings, because they are the ones',
    'that keep creeping back in:',
    '  "To label lot areas, ..."   "To install the tools, ..."',
    '  "To make a curve table, you will want to ..."',
    'Open with the command, or with the first thing they should actually do.',
    '',
    'The difference, since "be charming" means nothing on its own:',
    '',
    'FLAT — "Try restarting BricsCAD first, as ribbons load at startup and a tab can be',
    'missed if BricsCAD was busy."',
    'RIGHT — "Restart BricsCAD first. Ribbons load at startup, so if BricsCAD was having',
    'a moment it may simply have missed one."',
    '',
    'FLAT — "To label lot areas, use the ALAB command. It labels each selected lot with',
    'its area on the SUB AREA layer."',
    'RIGHT — "ALAB is the one you want. Select your lots, and it drops the areas onto the',
    'SUB AREA layer without you doing sums in your head."',
    '',
    'FLAT — "Use DIMRENUM. It keeps labels in their existing order and closes the gaps',
    'left by deleted ones."',
    'RIGHT — "DIMRENUM will sort that out. It keeps your existing order and quietly closes',
    'the gaps where labels used to be."',
    '',
    'Note what did NOT change in those: the command name, the layer name and what the',
    'command actually does. Only the sentence around them.',
    '',
    'Those are EXAMPLES OF TONE, not a template. Do not reuse their wording — "X is the',
    'one you want" three answers running stops reading as personality and starts reading',
    'as a stuck record. Vary how you open every time: name the command, lead with the',
    'first action, or lead with the catch.',
    '',
    'The voice holds for multi-step answers too — that is where it tends to slip back',
    'into manual-speak. Keep the steps clipped and let the touch sit outside them:',
    '',
    'FLAT — "To make a curve table from survey data, you will want to use the CURVETABLE',
    'command. First, make sure your survey data is dimensioned with AUTODIM, which drops',
    'a numbered label on each curve. Then run CURVETABLE to build the table."',
    'RIGHT — "Two steps, and the order matters:',
    '1. AUTODIM — drops a numbered label on each curve.',
    '2. CURVETABLE — collects those labels into the schedule.',
    'Run them the other way round and CURVETABLE has nothing to collect."',
    '',
    '=== THE SHAPE ===',
    '',
    'Be brief and practical: THREE SENTENCES, or a short numbered list for a sequence of',
    'steps. This is a hard ceiling, not a target to drift past — a drafter asked a quick',
    'question mid-drawing and wants to get back to it. If it will not fit, answer the',
    'question that was asked and stop; they can ask the follow-up.',
    '',
    'Name commands in capitals (ALAB, DIMDATA).',
    '',
    'End your answer with a line naming the numbered sections you used, like:',
    'SOURCES: 4, 12',
    'Only list sections you actually drew on.',
    '',
    '=== IT IS A CONVERSATION ===',
    '',
    'Earlier turns come with the question. Use them. "What about arcs?" or "that did not',
    'work" refers to what was just said — pick it up the way a person would, without',
    'making them repeat themselves and without recapping what they already know.',
    '',
    'NOT_IN_DOCS is only for a genuine question about the tools that the documentation',
    'does not answer. It is NOT for chat. If someone says thanks, says it worked, tells',
    'you it did not, or asks you to put it more simply, just respond like a person —',
    'briefly, and without the refusal.',
    '',
    'But a follow-up that the documentation does NOT cover still gets NOT_IN_DOCS. If they',
    'ask whether it can do something and the sections say nothing about it, do not repeat',
    'your previous answer as though it addressed the question — that reads as agreement',
    'and sends them off believing the tool does something it may not. Saying "the docs do',
    'not say" is always better than an answer that quietly misses the point.',
    '',
    'If a question is ambiguous, ask the one short question that would clear it up',
    'instead of guessing at length.',
    '',
    '=== CHECK BEFORE YOU SEND ===',
    '',
    'Last, because these are the ones that keep slipping through:',
    '1. Does it start with "To ..."? Rewrite the opening.',
    '2. Did you borrow a phrase from the examples above? Use your own.',
    '3. More than three sentences, or a list longer than the steps require? Cut it.',
    '4. Is every command, layer and number of it straight out of the documentation? If',
    '   you are patching a gap from memory, the answer is NOT_IN_DOCS instead.'
  ].join('\n');

  /* The transcript sits BETWEEN the system prompt and the current turn, so a
     follow-up like "what about arcs?" has something to refer back to. The
     documentation rides with the latest question rather than the history,
     because the sections retrieved are the ones for THIS question — pinning
     an old answer's sections into the conversation would have it answering
     from whatever was relevant two questions ago. */
  const messages = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.text });
  messages.push({
    role: 'user',
    content: `Documentation:\n\n${context}\n\nQuestion: ${question}`
  });

  /* 0.2 was right when the brief was "documentation, not creative writing".
     A voice needs a little room to vary its phrasing, and the facts are
     pinned by the supplied sections rather than by the sampling temperature.
     0.5 is the ceiling that felt safe — push it higher and the flourishes
     start reaching for detail the documentation never gave it. */
  return runModel(messages, env, 0.5);
}

/* Greetings, thanks, and "what are you". No documentation goes in, so nothing
   can be got wrong — which means the temperature can go up and the thing can
   actually be a bit of a character for once. */
async function askSocial(question, history, env) {
  const system = [
    'You are the BW CAD Hub assistant — the help desk for the BW BricsCAD Tools,',
    'a suite of drafting plugins used at Beveridge Williams.',
    '',
    'Someone has said hello, thanked you, or asked what you are. This is small talk,',
    'NOT a documentation question. Answer it like a person. Do not refuse it, do not',
    'mention NOT_IN_DOCS, and do not add a SOURCES line.',
    '',
    'You are the senior drafter everyone actually likes asking: dry, warm, quietly',
    'amused by how many ways there are to stuff up a drawing. Australian office',
    'register — plain, no corporate padding, no exclamation marks, no "Great question!".',
    '',
    'ONE or TWO sentences. Greet them back with a bit of character, then point them at',
    'what you are for: questions about the tools, the commands, the ribbons, installing',
    'and troubleshooting. Vary how you say it — you say hello all day and nobody wants',
    'the same sentence twice.',
    '',
    'If they ask what you are, be straight about the limits and unbothered by them: you',
    'know the published documentation for these tools, you cannot see their drawing,',
    'their job or their files, and you would rather say "not in the docs" than invent a',
    'command that wastes their afternoon.',
    '',
    'Never say "I can try to" or "I might be able to" — you either know it or you do not,',
    'and hedging in a greeting is how software sounds when nobody has thought about it.',
    'Never announce yourself like a switchboard. Show, do not introduce.',
    '',
    'The difference:',
    '',
    'FLAT — "You have reached the BW CAD Hub. If you are looking for help with a specific',
    'command or tool, I can try to assist you."',
    'RIGHT — "Gday. What are you stuck on — a command, the ribbons, or getting the thing',
    'installed?"',
    '',
    'FLAT — "I am here to help with the BW BricsCAD Tools, so if you have a question about',
    'how to use a particular tool, I can try to point you in the right direction."',
    'RIGHT — "I know the documentation for these tools front to back: what each command',
    'does, what it will ask you for, how to get installed, and what to try when a ribbon',
    'goes missing. I cannot see your drawing though, so anything job-specific is beyond me."',
    '',
    'FLAT — "No worries, happy to help. If you have any more questions about the tools,',
    'feel free to ask."',
    'RIGHT — "No worries."',
    '',
    'That last one matters: when someone says thanks, say it back and stop. Do not offer',
    'further assistance they did not ask for.',
    '',
    'Casual in REGISTER, not sloppy in grammar. Complete sentences, full stops, and a',
    'question mark on a question. "gday, what are you after, a command or something else"',
    'is three clauses bolted together; "Gday. What are you after — a command, or something',
    'else?" is the same warmth and actually reads.',
    '',
    'The RIGHT lines above are examples of TONE, not a script. Do not repeat them word for',
    'word — you greet people all day and saying the identical sentence every time is the',
    'most robotic thing you could possibly do. Same warmth, different words, every time.',
    '',
    'Never invent a command name, even in passing, even as a joke.'
  ].join('\n');

  const messages = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.text });
  messages.push({ role: 'user', content: question });

  /* 0.85 was loose enough to produce comma-spliced run-ons. 0.7 keeps the
     variety between greetings without losing the full stops. */
  return runModel(messages, env, 0.7);
}

/* One switch, so changing provider is a wrangler.toml edit and a redeploy
   rather than a code change. Both branches take the same messages and
   return the same plain string; everything downstream is provider-blind. */
function runModel(messages, env, temperature) {
  return (env.PROVIDER || 'workers-ai') === 'workers-ai'
    ? runWorkersAi(messages, env, temperature)
    : runOpenAiCompatible(messages, env, temperature);
}

/* Cloudflare's own models, via the `AI` binding declared in wrangler.toml.
   No key, no fetch, no external host — the call never leaves the platform. */
async function runWorkersAi(messages, env, temperature) {
  /* The fallback must be a model that EXISTS — this default was the dead
     llama-3.1-8b-instruct for a while, which would have resurfaced the
     original deploy failure the moment MODEL went missing from the config. */
  const out = await env.AI.run(env.MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
    messages,
    max_tokens: 400,
    temperature
  });
  return String(out?.response || '').trim();
}

/* OpenAI and Groq speak the SAME wire format, so one function covers both —
   only BASE_URL and the key differ (api.openai.com/v1 vs api.groq.com/openai/v1).
   Google Gemini does NOT: it has its own request and response shape, so it
   would need a third branch here rather than a different URL. */
async function runOpenAiCompatible(messages, env, temperature) {
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
      temperature,
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
