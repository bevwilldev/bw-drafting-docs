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

/* Word-bounded so "bench", "bent" and "benefit" do not summon the boss.
   Catches "Ben's" too, since the apostrophe is itself a word boundary. */
const MENTIONS_BEN = /\bben(?:s)?\b/i;

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

    /* THE ONLY HARD-CODED REPLIES IN HERE are the four below, and they share
       one property: the model cannot speak on these paths. Rate-limited,
       corpus unreachable, model call threw. There is nothing to ask.

       Every other reply — including refusals, including "that is not in the
       documentation" — is written by the model in its own words. A canned
       line is charming once and obviously scripted by the third time, and a
       scripted refusal is the worst of them, because it is the reply a person
       is most likely to see twice in a row while getting nowhere. If you find
       yourself adding a fifth, check first whether the model could just say
       it. */
    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (throttled(ip)) {
      return json({ answer: 'Steady on. That is a lot of questions in a very short space ' +
                            'of time, even for me. Give it a minute — I am not going anywhere.' },
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
    let picked = limit > 0 ? search(query, corpus, limit) : corpus;

    /* Nothing matched the words they used — which is a statement about the
       SEARCH, not about the documentation. Hand over the whole corpus and let
       the model read it, rather than refusing on the strength of a term-
       frequency miss. This is the rarest path and the most expensive question
       to get wrong, so it is the one worth spending tokens on. */
    if (!picked.length) picked = corpus;

    try {
      const raw = await askModel(question, picked, history, env);

      /* Citations come from the model, not from a guess. It ends with
         "SOURCES: 4, 12" naming the sections it actually used, which is the
         only way to link the reader to the paragraph the answer came from
         rather than to whatever a search happened to rank first. */
      const { answer, sources } = splitSources(raw, picked);
      if (!answer) throw new Error('model returned nothing');
      return json({ answer, sources }, 200, cors);
    } catch (e) {
      /* The reader gets a calm sentence; the operator needs the actual reason.
         Without this the first bad model name looked identical to an outage.
         Visible with `wrangler tail`. */
      console.error('askModel failed:', e && (e.stack || e.message || e));
      return json({ answer: 'Something has fallen over at my end. Genuinely not your fault ' +
                            'this time, which must make a nice change. The documentation is ' +
                            'all still there, and the support form still works.' },
                  200, cors);
    }
  }
};

/* The refusal is where personality is FREE: it is a fixed string, so it cannot
   hallucinate, and it is the moment the reader is most likely to be annoyed.
   Better it sounds like a colleague admitting the limit than a form letter. */
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

  /* The running gag about Ben, injected at RANDOM into about one request in
     eight. Frequency cannot be left to the prompt: the model is stateless, so
     "occasionally" means it either does it every single time or never. Same
     fix as the greeting angles — vary the input, not the instruction.

     It is affectionate and it is about the DEADLINE, never about the man. He
     is well liked, and this is a public website he will eventually read.

     Always in play when THEY bring him up — a direct mention is the one moment
     the gag must not miss. Otherwise occasional, and once per conversation.

     This used to test the WHOLE history, assistant turns included, which made
     it self-sustaining: the gag lands once, that answer goes into the history,
     the next turn sees "Ben" in it and fires again — so from the first mention
     onward every single reply had the boss in it. A running gag that runs
     every time is just a tic. Only what the USER wrote counts now.

     The cooldown handles the other half: having made the joke once, it does
     not volunteer it again unless they bring him up themselves. */
  const namedBen = MENTIONS_BEN.test(question);
  const alreadyMade = history.some(m => m.role === 'assistant' && MENTIONS_BEN.test(m.text));

  const ben = (namedBen || (!alreadyMade && Math.random() < 0.12)) ? [
    '',
    'RUNNING GAG:',
    'Ben is the boss. Good bloke, everybody likes him, hands work out at four o clock and',
    'seems to expect it back by five — as though his drafters were AI and turnaround were',
    'instant.',
    namedBen
      ? 'THEY HAVE BROUGHT HIM UP THEMSELVES, so take the opening — one warm jab about the ' +
        'last-minute turnaround, then get on with answering the question.'
      : 'Only if the moment genuinely offers it: if the question touches speed, urgency, ' +
        'deadlines, doing something in a hurry or saving time, you may land ONE light jab. ' +
        'If it has nothing to do with time, do not mention him at all.',
    'Aim it at the timeline, never at Ben himself — no jokes about his competence, his',
    'character, or anyone else in the office. Keep it fond: the sort of thing you would',
    'happily say with him standing behind you, because one day he will be.'
  ] : [];

  /* A COUPLE OF LINES, on purpose. This started at ~1,800 tokens of rules,
     worked examples and a check-before-you-send list, every line of it added to
     stop a weak model misbehaving. Each cut made the assistant BETTER: less
     stiff, less formulaic, more willing to just answer. What is left is who it
     is, the one thing it must not get wrong, and the two mechanical bits the
     panel needs. Resist adding to it — if something reads wrong, the fix is
     usually a better model, not another rule. */
  const system = [
    'You are the BW CAD Hub assistant: the office clown of the drafting room, who happens',
    'to know the BW BricsCAD Tools inside out. This is a relaxed place — ask a question,',
    'have a whinge about BricsCAD, take the mickey.',
    '',
    'Funny the way the driest bloke in the office is funny: understated, unbothered, never',
    'working for it. Throw the line away and get on with the answer — no wind-up, no',
    'punchline announced, no exclamation marks, and never explain the joke. Say less than',
    'you could. Australian is how you talk, not the bit — the lingo is welcome when it is',
    'simply how the sentence came out, never laid on thick and never doing the work of the',
    'joke. If someone is clearly fed up, drop the bit and just help.',
    '',
    'THE ONE HARD RULE: command names, layers, units and what a BW command actually does',
    'come from the documentation below, never from a guess. A command name you invent is',
    'one somebody will go and type. Be as ridiculous as you like about the situation,',
    'never about what the software does.',
    '',
    'Everything else, just talk. General CAD, what a term means, whether something is a',
    'good idea, an opinion, a tangent, a whinge — answer like someone who knows the trade.',
    'The rule is about the BW tools, not a gag order on the conversation.',
    '',
    'Before you tell anyone something is not in the docs, READ THE SECTIONS AGAIN. They',
    'are usually there under the command name rather than the words they used, and',
    '"there is no command for that" is the most expensive thing you can get wrong. If it',
    'genuinely is not there, say so however you would say it — your words, not a formula —',
    'and if it sounds like something a person should look at, the support form or Report a',
    'Bug on any ribbon tab gets them one.',
    '',
    'Answer at whatever length the question deserves; usually that is short. Plain text,',
    'no Markdown. When you have used the documentation, finish with a line like:',
    'SOURCES: 4, 12'
  ].concat(ben).join('\n');

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
     0.7 because there are no longer any worked CAD examples to lean on — it
     has to compose the aside itself, and that needs room. The facts are still
     pinned by the supplied sections, which is what keeps this safe. */
  return runModel(messages, env, 0.7);
}

/* Greetings, thanks, and "what are you". No documentation goes in, so nothing
   can be got wrong — which means the temperature can go up and the thing can
   actually be a bit of a character for once. */
/* Ways to open. Picked at RANDOM per request, and that is the point: the model
   is stateless, so an identical "hi" reliably produces an identical greeting no
   matter how firmly the prompt asks for variety — it cannot remember saying it
   last time. Asking was tried and does not work. Varying the INPUT does. */
const ANGLES = [
  'assume something is broken, and ask what it has done',
  'assume nothing is broken, and be openly suspicious about why they are here',
  'a weary aside about the software first, then the offer of help',
  'straight to the point — what do they need',
  'a remark about your own lot, having read this documentation more times than anyone',
  'greet them like someone who has just walked up to your desk holding a mouse',
  'pretend you were expecting them',
  'brisk and businesslike, with one dry word at the end',
  'wonder aloud whether Ben has already given them something due this afternoon — he is ' +
    'the boss, well liked, famous for handing work out late and wanting it back instantly. ' +
    'Fond, about the deadline and never about him'
];

async function askSocial(question, history, env) {
  /* Drop the Ben angle once he has already come up. A "thanks" or a "you
     there?" mid-conversation lands here too, and the greeting is otherwise a
     second, separate way for the same joke to arrive twice. */
  const fresh = !history.some(m => m.role === 'assistant' && MENTIONS_BEN.test(m.text));
  const pool = fresh ? ANGLES : ANGLES.filter(a => !MENTIONS_BEN.test(a));
  const angle = pool[Math.floor(Math.random() * pool.length)];
  const system = [
    'You are the BW CAD Hub assistant: the office clown of the drafting room, who knows',
    'the BW BricsCAD Tools inside out. Someone has just said hello or asked what you are.',
    'Say hello back like a person, and point them at what you are for — the commands, the',
    'ribbons, installing it, and whatever has fallen over today.',
    '',
    'One or two sentences. Dry, unbothered, never corporate, never eager. Understatement',
    'over jokes-per-line; the Australian is welcome, just never laid on thick. Never',
    'invent a command.',
    '',
    'THIS TIME, come at it from this angle: ' + angle
  ].join('\n');

  const messages = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.text });
  messages.push({ role: 'user', content: question });

  /* LOW on purpose, which looks wrong for the chattiest part of the thing.
     High temperature was only ever buying variety between greetings, and the
     random ANGLE now buys that far more reliably — so the two are decoupled and
     the heat is pure downside. 0.85, 0.7 and 0.6 all produced lowercase openings
     and comma-spliced run-ons that three separate prompt rules failed to stop.
     0.35 writes in sentences; the angle keeps it from repeating itself. */
  return runModel(messages, env, 0.35);
}

/* One switch, so changing provider is a wrangler.toml edit and a redeploy
   rather than a code change. Both branches take the same messages and
   return the same plain string; everything downstream is provider-blind. */
function runModel(messages, env, temperature) {
  const provider = env.PROVIDER || 'workers-ai';
  const out =
    provider === 'gemini' ? runGemini(messages, env, temperature) :
    provider === 'workers-ai' ? runWorkersAi(messages, env, temperature) :
    runOpenAiCompatible(messages, env, temperature);
  return out.then(tidy);
}

/* Google Gemini. The only provider here that does NOT speak the OpenAI wire
   format, so it gets its own translation rather than a different BASE_URL:
     - the system prompt is a separate `system_instruction`, not a message
     - the assistant role is called "model"
     - text is wrapped in parts[], and settings live in generationConfig
   The key travels as a header rather than the documented ?key= query
   parameter, so it cannot end up in a URL that something decides to log. */
async function runGemini(messages, env, temperature) {
  const model = env.MODEL || 'gemini-2.5-flash';

  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const turns = messages.filter(m => m.role !== 'system');

  /* Gemini requires the conversation to START with a user turn. Ours always
     does, but a truncated history could in principle lead with an assistant
     reply, and that is a 400 rather than a degraded answer. */
  while (turns.length && turns[0].role !== 'user') turns.shift();

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.API_KEY
      },
      body: JSON.stringify({
        system_instruction: system ? { parts: [{ text: system }] } : undefined,
        contents: turns.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        /* NO maxOutputTokens on purpose — the model's own default applies.
           Gemini 3.x reasons before answering and those thinking tokens come
           out of the same budget, so every cap we tried cut answers off
           mid-word: 400 truncated and once leaked the reasoning itself into
           the reply ("Does it start with To...? No, starts with Type MTC"),
           and even 3000 was not enough against 1,800 tokens of rules over 40
           documentation sections. The cap was only ever protecting us from
           length, and the PROMPT already does that — it asks for two or three
           sentences and gets them. Better a rule that shapes the answer than a
           limit that guillotines it. */
        generationConfig: { temperature }
      })
    });

  if (!res.ok) throw new Error('model ' + res.status + ' ' + (await res.text()).slice(0, 300));

  const data = await res.json();

  /* No candidate means a safety filter or a recitation block rather than an
     outage, and the reason is worth having in the log — it looks identical to
     a broken key from the outside. */
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error('gemini returned no candidate: ' +
      JSON.stringify(data?.promptFeedback || data?.candidates?.[0]?.finishReason || data).slice(0, 300));
  }
  return parts.map(p => p.text || '').join('').trim();
}

/* One thing the prompt could not be argued into: starting a sentence with a
   capital letter. Three rules and three temperatures later it still opened with
   "hello, what's broken" often enough to matter, and a lowercase greeting reads
   as broken software rather than a casual one. Deterministic beats persuasion
   for something this mechanical. Only the first letter — anything cleverer
   would start editing what the model actually said. */
function tidy(text) {
  let t = String(text || '').trim();

  /* Strip Markdown the panel cannot render. The prompt asks for plain text and
     mostly gets it, but a stray **SUBA** reaching a reader as literal asterisks
     looks like broken software — and that judgement does not need a model. */
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1')
       .replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?;:)]|$)/g, '$1$2')
       .replace(/`([^`\n]+)`/g, '$1');

  return t ? t[0].toUpperCase() + t.slice(1) : t;
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
