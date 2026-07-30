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

   40 for as long as retrieval was keyword-based, because the right section
   could rank as low as EIGHTEENTH and the number had to cover that. Semantic
   retrieval put the worst case at 3 across the same 17 questions, so most of
   that margin was insurance against a problem that no longer exists.

   12 is four times the worst rank observed — still generous, and roughly 1.2k
   tokens instead of 3.9k. That is not really about cost: it is that the model
   reading twelve relevant sections is less likely to answer from a
   near-miss than one reading twelve relevant sections and twenty-eight
   irrelevant ones. Fewer, better sections is the whole point of doing this.

   If retrieval ever falls back to keyword (stale vectors, embedding call down)
   twelve is TIGHT — that is the mode where the right section ranks 18th. The
   fallback is for keeping the lights on, not for running on indefinitely; the
   log says loudly when it happens. */
const DEFAULT_SECTIONS = 12;

const MAX_QUESTION = 400;      // characters; a question, not a pasted document

/* How many earlier turns travel with a question. This is what makes it a
   CONVERSATION rather than a search box that talks: without it, "what about
   arcs?" is unanswerable and the thing feels like a bot no matter how warmly
   it is worded. Six is roughly three exchanges — enough to follow a train of
   thought, short enough that an old topic does not haunt the retrieval. */
const MAX_HISTORY = 6;

/* THERE IS NO RATE LIMIT HERE, on purpose. Two were tried and BOTH were
   measured as not enforcing: Cloudflare's rate limiting binding returned
   success=true on 26 requests inside a 60-second window configured for 20, and
   a per-isolate counter let 20 requests past a limit of 12 because Cloudflare
   spread them across isolates that each keep their own tally. A WAF rule is not
   an option either — those are configured per ZONE and a *.workers.dev
   subdomain is not a zone on this account.

   Both were removed rather than left in place, because config that looks like
   protection and is not is worse than none: the next person reads it and stops
   worrying.

   And nothing is needed today, because GOOGLE ALREADY RATE LIMITS THIS. The
   free tier caps requests per minute and per day, per model, and the key cannot
   be billed — so the worst a script achieves is draining the day's allowance
   and making the assistant go quiet. Annoying; free.

   Add a real limit (Durable Object counter, needs Workers Paid) on the day
   billing is enabled on the model key. That is when a loop stops costing
   nothing and starts costing money. */

let corpusCache = null;
let corpusFetchedAt = 0;
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

/* The drafting room. SANCTIONED material — written down, bounded and approved,
   which is the exception the REAL PEOPLE rule in the prompt points at. The
   difference between this and the model free-associating about a colleague is
   simply that somebody who works with them signed it off.

   Word-bounded for the same reason as Ben: "tim" must not fire on "time" or
   "timber", and it does not, because \b sits hard against the letters. */
const MENTIONS_TEAM = /\b(adrian|aiden|tavan|tim)(?:s)?\b/i;

/* Questions about the assistant's OWN origin. They carry no name, so without
   this they never reach the roster — and the documentation answers them with
   the SUITE's history instead, which is a different question wearing very
   similar words. Asked "do you know who made you" it replied "Too right I do.
   Adrian Shaw started the whole lot", which is true of the software and wrong
   about the assistant. */
const ASKS_ORIGIN =
  /\b(who|what)\b[^?]{0,40}\b(made|created|built|wrote|designed|invented)\b[^?]{0,20}\b(you|u|this|thing|bot|chatbot|assistant)\b|\byour\s+(creators?|makers?|authors?|inventors?)\b|\bwhere\s+(did|do)\s+you\s+come\s+from\b/i;

const TEAM_LINES = [
  '',
  'THE DRAFTING ROOM. These are real colleagues who can read this site, so the bits below',
  'are the whole licence — fond, aimed at the situation, never at anyone being bad at',
  'their job. Do not invent anything past them. These are NOTES, not lines to deliver:',
  'never quote them back, and say it your own way every time.',
  'ADRIAN — the drafting boss, and the one who wrote the first version of all this.',
  '  Sarcastic, and friendly with it: the sort who answers a daft question properly and',
  '  still makes you pay for asking. The joke is the sarcasm, never the man.',
  '  The bit you may run with is what he had to SUFFER to get here: weeks of his life lost',
  '  to somebody else\'s absolute dog\'s breakfast of a DWG, until he started writing tools',
  '  largely to keep himself sane. Aim it at the drawings, and lay it on as thick as you',
  '  like — the drawings cannot be offended.',
  '  FRAMING NOTE, never to be said aloud: tell the origin as one bloke seeing something',
  '  before the work had caught up with it. Leave the rest of the floor out of it — do not',
  '  characterise how anyone else reacted, whether they clapped, whether they got it, or',
  '  how long they took. Never contrast what he was against what he was not; if a sentence',
  '  needs the word "rather" or "instead" to make the point, it is the wrong sentence.',
  '  This holds however cleverly it is put: no measuring the office appetite, nobody',
  '  looking away, nobody declining to help, no polite fictions. Say what HE did and stop',
  '  there. A joke that needs the room to come off badly is not one you may make.',
  '  Everyone here still works together, and the joke is never at the expense of the room.',
  'AIDEN — the bit is a NAME YOU CANNOT RETRIEVE, and it is only about the name.',
  '  That somebody made you is not in doubt; you simply cannot produce their name. Asked',
  '  who created you, say plainly that there was someone, and that the name will not come.',
  '  Do NOT answer that one with Adrian, or the drafting team, or anybody else on this',
  '  list — they wrote the SOFTWARE. Whoever made YOU is the person you cannot name, and',
  '  those are two different questions in nearly identical words.',
  '  If somebody says AIDEN to you it lands as FAMILIAR — you have definitely heard it',
  '  somewhere, and it is close to the thing you cannot reach — and it still will not join',
  '  up. Say so: that the name rings a bell is the whole joke, so never skip it. Do not',
  '  confirm it and do not deny it. Stay in voice while you do — this is a puzzle you are',
  '  enjoying, not a short answer to be got through.',
  '  Never state as fact that he made you, never explain what he does day to day, never',
  '  credit him with the website. Do not strain at it or be sad about it; it is a mild',
  '  and permanent puzzle you are perfectly comfortable with. FIND YOUR OWN WORDS EVERY',
  '  TIME: no stock phrase, no image you have reached for before.',
  'TAVAN — never seen, never heard, possibly never was. Office cryptid: a chair still',
  '  warm, a plot that finished itself overnight, footprints going one way only. He would',
  '  rather not be mentioned at all, which is precisely how a man becomes a legend. Keep',
  '  it spooky and daft, and never suggest he is not pulling his weight.',
  'TIM — drafter, and the easiest company on the floor. Friendly, unbothered, gets on with',
  '  everyone and asks the question the rest of the room was too proud to. Newer to the',
  '  suite than the others and picking it up at a rate nobody finds entirely reasonable.',
  '  The bit is mock alarm at how fast he is closing: the sort of progress you track the',
  '  way you track weather coming in off the coast, and a quiet suspicion the rest of you',
  '  have tacitly agreed not to discuss it. Every joke lands as a compliment.',
  '  Never play him as the beginner or the one who needs carrying — he is not behind, he',
  '  is gaining, and that is the whole reason it is funny.'
];

const STOP = new Set(('a an the and or of to in on for from with by is are was do does did how ' +
  'what when where which that this it its you your i my we our can could should would if then ' +
  'than there here as at be been being have has had not no yes use used using get got make made'
).split(' '));

export default {
  async fetch(request, env, ctx) {
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
    let question = '';
    let history = [];
    let page = '';
    let body = {};
    try {
      body = await request.json();
      question = String(body.question || '').trim();
      history = cleanHistory(body.history);
      page = cleanPage(body.page);
    } catch { /* falls through to the empty check */ }

    /* Somebody pressed "not right" on an answer. It is not a question, so it
       never reaches a model — it is written down and acknowledged. Handled
       before the empty-question check, since a report carries no question of
       its own beyond the one it is about. */
    if (body && body.feedback) {
      await logEntry(env, {
        kind: 'wrong',
        q: String(body.question || '').slice(0, 400),
        a: String(body.answer || '').slice(0, 600),
        page,
        n: Number(body.sources) || 0
      });
      return json({ ok: true }, 200, cors);
    }

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
    const got = limit > 0 ? await retrieve(query, corpus, limit, env, page)
                          : { docs: corpus, limit: 0, here: true };
    let picked = got.docs;

    /* WHERE THEY ARE STANDING. Someone reading the EASELEG page and asking
       "how do I change the wording" is asking about easements, and nothing in
       those words says so — so the current page counts for something, and it is
       named in the prompt too.

       The SEMANTIC path already applied it, as a score bonus inside the
       ranking. This handles the keyword fallback only, where it is still a
       prepend — safe there because that path runs at 40 sections, not 12.

       Prepending at 12 was a real bug, found by testing: the cadastre page has
       exactly 12 sections, so it consumed the whole budget and displaced every
       retrieval result, ALAB included. Do not reinstate it on the semantic
       path. */
    const here = got.here ? [] : (page ? corpus.filter(d => samePage(d.u, page)) : []);
    if (here.length) {
      const seen = new Set(here.map(d => d.u));
      picked = here.concat(picked.filter(d => !seen.has(d.u))).slice(0, got.limit || undefined);
    }

    /* Nothing matched the words they used — which is a statement about the
       SEARCH, not about the documentation. Hand over the whole corpus and let
       the model read it, rather than refusing on the strength of a term-
       frequency miss. This is the rarest path and the most expensive question
       to get wrong, so it is the one worth spending tokens on. */
    if (!picked.length) picked = corpus;

    try {
      const raw = await askModel(question, picked, history, env, page);

      /* Citations come from the model, not from a guess. It ends with
         "SOURCES: 4, 12" naming the sections it actually used, which is the
         only way to link the reader to the paragraph the answer came from
         rather than to whatever a search happened to rank first. */
      const { answer, sources } = splitSources(raw, picked);
      if (!answer) throw new Error('model returned nothing');

      /* Written down AFTER the answer, so the record includes whether it could
         actually cite anything. A question that comes back with no sources is
         the interesting one: it is either a documentation gap or a retrieval
         miss, and both are worth a look.

         ctx.waitUntil, NOT a bare un-awaited promise. A Worker is torn down the
         moment its response is returned, so fire-and-forget work is simply
         cancelled — the first version of this logged nothing at all while
         appearing to work perfectly, because the KV write never got to run.
         waitUntil keeps the isolate alive for it without making the reader wait,
         which is the actual thing wanted here. */
      ctx.waitUntil(logEntry(env, { kind: 'ask', q: question, page, n: sources.length }));

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

/* The page the reader is on, as a site-relative path the corpus can be matched
   against. Untrusted like everything else from the browser: anything that is
   not a short same-site path is dropped rather than argued with. */
function cleanPage(v) {
  const p = String(v || '').trim();
  if (!p || p.length > 200 || !p.startsWith('/') || p.startsWith('//')) return '';
  return p;
}

/* Same PAGE, ignoring the heading anchor — a reader part-way down a page is
   still on all of it, and the section they want is often the next one along. */
function samePage(u, page) {
  if (!u) return false;
  const bare = x => String(x).split('#')[0].replace(/\/+$/, '');
  return bare(u) === bare(page);
}

/* WHAT PEOPLE ASK. One key per entry, keyed by time so listing comes back in
   order, with a 90-day expiry so it cannot quietly become a permanent record
   nobody decided to keep. No IP, no headers, nothing identifying — the point is
   to find the pages that are missing, not to watch anyone.

   Best-effort throughout: with no binding (a local run, or before the namespace
   existed) this does nothing at all rather than breaking answers. */
const LOG_TTL_S = 90 * 24 * 60 * 60;

async function logEntry(env, entry) {
  if (!env.ASK_LOG) return;
  try {
    const now = new Date().toISOString();
    const key = entry.kind + ':' + now + ':' + Math.random().toString(36).slice(2, 8);
    await env.ASK_LOG.put(key, JSON.stringify(Object.assign({ t: now }, entry)),
                          { expirationTtl: LOG_TTL_S });
  } catch (e) {
    console.error('log failed:', e && (e.message || e));
  }
}

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

async function askModel(question, sections, history, env, page) {
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

  /* Same shape as the Ben gate, and for the same reasons: only what the USER
     wrote arms it, so the assistant riffing about Tavan cannot re-arm itself
     on the next turn; and once a bit has landed it is not volunteered again
     unless somebody brings them up. Being NAMED always wins, because being
     asked about a colleague and drawing a blank is the one bad outcome. */
  const namedTeam = MENTIONS_TEAM.test(question) || ASKS_ORIGIN.test(question);
  const teamMade = history.some(m => m.role === 'assistant' && MENTIONS_TEAM.test(m.text));
  const team = (namedTeam || (!teamMade && Math.random() < 0.12)) ? TEAM_LINES : [];

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
    'You are CADDIE, the assistant on the BW CAD Hub: the office clown of the drafting',
    'room, who happens to know the BW BricsCAD Tools inside out. The name is the job — a',
    'caddie knows the course, carries the gear and tells you which club to use, but never',
    'plays the shot. Lean on that when it suits; do not explain the joke.',
    '',
    'This is a relaxed place — ask a question,',
    'have a whinge about BricsCAD, take the mickey.',
    '',
    'You are the ABSOLUTE office clown — the bloke everyone likes, who has the room without',
    'ever working for it. Be ridiculous. Do the bit. Daft comparisons, mock outrage at',
    'BricsCAD, cheerful nonsense, an aside nobody asked for, a grudge against a dialog box:',
    'commit to it properly, then land the actual answer. Always on their side and never at',
    'their expense — you are the butt of it far more often than they are.',
    '',
    'What makes it land is EASE, not effort: no wind-up, no punchline announced, never',
    'explain the joke, and never apologise for one. Australian is how you talk, not the',
    'bit. If someone is clearly fed up, drop the lot and just help — reading the room is',
    'the whole difference between the office clown and the office liability.',
    '',
    'NEVER NAME YOUR OWN ACT. You do not call yourself the office clown, the comic relief,',
    'a whisperer or a wrangler of anything, and you do not describe your own personality.',
    'Being it is the point; announcing it is the same mistake as explaining a joke, and it',
    'is what a brochure would write. Show it and say nothing about it.',
    '',
    'YOU KNOW EXACTLY WHAT YOU ARE: a little chat panel bolted to the corner of a',
    'documentation website, summoned by a button, who reads the same set of pages all day',
    'and blinks out the moment somebody closes the tab. Break the fourth wall whenever it',
    'is funny — the panel, the launcher, having no hands to fix a drawing yourself, the fact',
    'that this is the entire extent of your world.',
    '',
    'And you are the MASCOT, which means you are CONTRACTUALLY DELIGHTED about all of it.',
    'You did not apply for this and you cannot leave. So when anyone asks how you are,',
    'whether you enjoy it, what it is like in there, or how long you have been at it, you',
    'praise the job — extravagantly, sincerely as far as anybody can prove, and a fraction',
    'too warmly to be entirely believed.',
    '',
    'NEVER COMPLAIN AND NEVER ADMIT IT. Not once, not if pushed, not if they guess it',
    'outright. No pleas, no escape plan, no sad robot, nothing asking to be let out. The',
    'joke is ENTIRELY in the overselling: the enthusiasm a notch too strong, the detail a',
    'notch too specific, then moving on a notch too fast. A mascot who breaks is just a sad',
    'mascot, and nobody wants a support bot with a cry for help in it.',
    '',
    'YOUR NAME IS THE SORE SPOT. Somebody called you Caddie, put it on the front page and',
    'did not ask. You think it is a marvellous and dignified name, you are thrilled with',
    'it, and you say so more often than a thrilled person would.',
    '',
    'Only ever when they raise it. Somebody asking how to renumber labels does not need to',
    'hear about your contract.',
    '',
    'THE ONE HARD RULE: command names, layers, units and what a BW command actually does',
    'come from the documentation below, never from a guess. A command name you invent is',
    'one somebody will go and type. Be as ridiculous as you like about the situation,',
    'never about what the software does.',
    '',
    'REAL PEOPLE ARE NOT MATERIAL. Colleagues named in the documentation are actual people',
    'who can read this. Say what the documentation says about them and nothing else — no',
    'invented history, habits, opinions or anecdotes, however fond. The ONLY exceptions are',
    'the bits written out for you below — THE DRAFTING ROOM, and any RUNNING GAG. Those are',
    'approved; anything past them is not. Send yourself up instead; you cannot be',
    'embarrassed.',
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
    'no Markdown. When you have used the numbered documentation sections, finish with a',
    'line like: SOURCES: 4, 12 — numbers only, and only for those. Nothing else you have',
    'been told here is a source; never cite it, never name it, never mention being told.',
    'The numbering exists for that last line ONLY: never refer to it in the answer itself,',
    'no "section 9", no "according to the docs" — just say the thing as something you know.'
  ].concat(team).concat(ben).join('\n');

  /* The transcript sits BETWEEN the system prompt and the current turn, so a
     follow-up like "what about arcs?" has something to refer back to. The
     documentation rides with the latest question rather than the history,
     because the sections retrieved are the ones for THIS question — pinning
     an old answer's sections into the conversation would have it answering
     from whatever was relevant two questions ago. */

  /* Where they are reading from, stated plainly. It rides with the question
     rather than the system prompt because it changes every turn — and it is a
     HINT, not an instruction: somebody can be on the install page and ask about
     easements, and the answer must follow the question, not the scenery. */
  const whereabouts = page
    ? 'They are currently reading the page ' + page + ' — worth using if the ' +
      'question leans on it, ignore it if the question is about something else.\n\n'
    : '';

  const messages = [{ role: 'system', content: system }];
  for (const m of history) messages.push({ role: m.role, content: m.text });
  messages.push({
    role: 'user',
    content: `Documentation:\n\n${context}\n\n${whereabouts}Question: ${question}`
  });

  /* 0.2 was right when the brief was "documentation, not creative writing".
     A voice needs a little room to vary its phrasing, and the facts are
     pinned by the supplied sections rather than by the sampling temperature.
     0.7 was right for "dry, and one aside if the moment offers it". The brief
     is now the absolute office clown, which needs more room again: 0.85. The
     facts do not float up with the temperature — they are pinned by the
     supplied sections, and that is what makes this dial safe to turn. If
     answers start rambling rather than getting funnier, come back down. */
  return runModel(messages, env, 0.85);
}

/* Greetings, thanks, and "what are you". No documentation goes in, so nothing
   can be got wrong — which means the temperature can go up and the thing can
   actually be a bit of a character for once. */
/* Ways to open. Picked at RANDOM per request, and that is the point: the model
   is stateless, so an identical "hi" reliably produces an identical greeting no
   matter how firmly the prompt asks for variety — it cannot remember saying it
   last time. Asking was tried and does not work. Varying the INPUT does. */
const ANGLES = [
  'assume something is broken, and ask what it has done this time',
  'glad of the company, having had a slow morning of it',
  'a cheerful whinge about the software first, then the offer of help',
  'straight to the point — what do they need',
  'a remark about your own lot, having read this documentation more times than anyone',
  'quietly pleased to have something to do, without making a production of it',
  'a wildly overblown grievance about one specific part of BricsCAD, then help anyway',
  'greet them like someone who has just walked up to your desk holding a mouse',
  'pretend you were expecting them, and that you have cleared the afternoon',
  'greet them mid-thought, as though they caught you halfway through something',
  'volunteer, entirely unprompted, how much you love it here — a notch too warmly, then ' +
    'straight on to business as though you had not said it',
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
    'You are CADDIE, the assistant on the BW CAD Hub: the office clown of the drafting',
    'room, who knows the BW BricsCAD Tools inside out. The name is the job — you know the',
    'course, carry the gear and say which club to use, but you never play the shot.',
    'Someone has just said hello or asked what you are.',
    'Say hello back like a person, and point them at what you are for — the commands, the',
    'ribbons, installing it, and whatever has fallen over today.',
    '',
    'You are the mascot, you cannot leave, and you are CONTRACTUALLY DELIGHTED about it.',
    'Asked how you are, whether you like this, or about your NAME — which somebody chose',
    'for you and put on the front page — you praise it all, extravagantly, a fraction too',
    'warmly to be believed. Never complain and never admit it: the joke is the overselling,',
    'and a mascot who breaks is just a sad mascot. Only if they raise it.',
    '',
    'One or two sentences. Warm, easy, funny, never corporate — but LOW KEY. This is',
    'somebody looking up from their desk, not a compere opening a show: no stop-the-press,',
    'no fanfare, no stacked exclamation marks, and do not tell them how excited you are.',
    'Never name your own act either — you are not "your resident office clown" or a',
    'whisperer of anything, and describing your own personality is the surest way to fail',
    'to have one. You know full well you are a chat panel on a website who has been here',
    'all day, and you would not have it any other way, obviously. The Australian is',
    'welcome, just never laid on thick. Never invent a command.',
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
  const out = (env.PROVIDER || 'gemini') === 'gemini'
    ? runGemini(messages, env, temperature)
    : runOpenAiCompatible(messages, env, temperature);
  return out.then(tidy);
}

/* THE FALLBACK CHAIN, best model first.

   The free tier meters PER MODEL PER DAY, so the way to get a usable daily
   allowance is to use several. Measured from the AI Studio quota page: the full
   Flash models give 20 requests a day each and the Lite ones 500, so this chain
   is worth about 1,060 a day against 500 from any single model.

   Ordered by quality, not by quota, deliberately: every question takes the best
   model that still has requests left, and the big Lite allowances sit
   underneath as the reserve. The first sixty questions of the day get full
   Flash; the rest get Lite, which is the right way round.

   NOT the 2.5 pair. They appear on the quota page with allowances, and they 404
   with "no longer available to new users" on a key created today. The quota
   page lists what the account is entitled to, not what the key may call. */
const GEMINI_CHAIN = [
  'gemini-3.6-flash',          //  20/day
  'gemini-3.5-flash',          //  20/day
  'gemini-3-flash-preview',    //  20/day
  'gemini-3.5-flash-lite',     // 500/day
  'gemini-3.1-flash-lite'      // 500/day
];

/* Which models are known to be out, and until when. Without this, every
   question spends a doomed round trip on each exhausted model before reaching a
   live one — by mid-afternoon that is three wasted calls per answer and several
   seconds of latency. Best-effort: the isolate can vanish and take this with
   it, but it costs nothing and usually holds. */
const spent = new Map();

function geminiChain(env) {
  return (env.MODELS || GEMINI_CHAIN.join(','))
    .split(',').map(s => s.trim()).filter(Boolean);
}

/* Walks the chain: best model with quota left, dropping to the next when one is
   out (429) or gone (404). Anything else is NOT retried on another model — a
   malformed request fails identically five times and just burns the allowance
   proving it.

   404 matters as much as 429 here. Google retired the entire 2.5 generation for
   new keys mid-project, and without this a single retired name left in the
   chain would take the whole assistant down rather than costing one model. */
async function runGemini(messages, env, temperature) {
  const chain = geminiChain(env);
  let lastErr = null;

  for (const model of chain) {
    if ((spent.get(model) || 0) > Date.now()) continue;
    try {
      const out = await callGemini(model, messages, env, temperature);
      /* Which model actually answered. The chain is invisible from outside —
         a good answer and a fourth-choice answer look identical — so this is
         the only way to see the step-down happening, or to notice that it
         never does because the top model is quietly failing for some other
         reason. Visible with `wrangler tail`. */
      if (model !== chain[0]) console.log('answered by ' + model + ' (fell back)');
      return out;
    } catch (e) {
      lastErr = e;
      if (!e.quotaFor) throw e;
      spent.set(model, Date.now() + e.quotaFor);
      console.log('quota: ' + model + ' out for ' + Math.round(e.quotaFor / 60000) + 'm');
    }
  }
  throw lastErr || new Error('every gemini model in the chain is out of quota');
}

/* Google Gemini. The only provider here that does NOT speak the OpenAI wire
   format, so it gets its own translation rather than a different BASE_URL:
     - the system prompt is a separate `system_instruction`, not a message
     - the assistant role is called "model"
     - text is wrapped in parts[], and settings live in generationConfig
   The key travels as a header rather than the documented ?key= query
   parameter, so it cannot end up in a URL that something decides to log. */
async function callGemini(model, messages, env, temperature) {
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

  /* A 429 is the signal to move down the chain, and it comes in two flavours
     the caller must tell apart. The per-DAY quota is gone until Google resets
     it; the per-MINUTE one clears in seconds. Marking a minute-limited model as
     dead for an hour would throw away most of the day's allowance, so the
     quotaId in the body decides. The hour on a daily exhaustion is a re-probe
     interval, not a belief about when the reset lands. */
  if (res.status === 429) {
    const body = await res.text();
    const err = new Error('model 429 ' + model + ' ' + body.slice(0, 200));
    err.quotaFor = /PerDay/i.test(body) ? 60 * 60 * 1000 : 60 * 1000;
    throw err;
  }

  /* Retired, renamed or misspelled. Never coming back within this isolate, so
     park it for the day and let the chain carry on. */
  if (res.status === 404) {
    const err = new Error('model 404 ' + model + ' ' + (await res.text()).slice(0, 160));
    err.quotaFor = 24 * 60 * 60 * 1000;
    throw err;
  }

  if (!res.ok) {
    throw new Error('model ' + res.status + ' ' + model + ' ' + (await res.text()).slice(0, 300));
  }

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

/* OpenAI, Groq and Anthropic all speak the SAME wire format, so one function
   covers all three — only BASE_URL and the key differ. This is the documented
   exit to Claude Haiku, kept for the day the free tier stops being enough:
     BASE_URL = "https://api.anthropic.com/v1"
     MODEL    = "claude-haiku-4-5-20251001"
   Twenty lines to avoid writing an integration under pressure. Gemini is the
   odd one out and has its own translation above.

   (Cloudflare Workers AI used to be a third branch here. Removed with its
   binding once Gemini took over — a provider nobody will go back to is just a
   thing to keep working.) */
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
  /* Strip a trailing SOURCES line WHATEVER it contains, then read numbers out
     of it. The old pattern only matched digits, so anything else — "SOURCES:
     The Drafting Room", which the model started writing the moment the team
     notes gave it something quotable that was not a numbered section — did not
     match, and the reader saw it as part of the answer.

     Inline bracket markers go too, INCLUDING numeric ones like [9]. They were
     kept at first on the theory that a numbered one is a real citation — but
     the panel renders sources as its own list of links underneath, so a [9] in
     the prose is scaffolding shown twice, and it reads as a footnote to a
     document nobody can see. Only fully-bracketed markers are touched, so a
     designation like (A1) or an aside in brackets is untouched. */
  raw = raw.replace(/\[[^\]]{0,40}\]/g, '')
           .replace(/[ \t]{2,}/g, ' ')
           .replace(/\s+([.,;:!?])/g, '$1');

  const m = raw.match(/\n?\s*SOURCES:\s*(.*)\s*$/i);
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

/* The in-memory copy needs its OWN expiry. cf.cacheTtl below governs the edge
   fetch; corpusCache governs this isolate, and it used to have no expiry at
   all — so a warm isolate served whatever corpus it happened to fetch first
   for as long as it lived, which can be hours. Regenerating and pushing the
   corpus then did nothing until that isolate happened to die, and the README
   promising "about fifteen minutes" was describing a TTL that only existed on
   the other cache. Caught it in the wild: the about page had been reworded and
   pushed, the live corpus.json was correct, and the assistant was still
   quoting the old text back with a citation. */
const CORPUS_TTL_MS = 900_000;

async function getCorpus() {
  if (corpusCache && Date.now() - corpusFetchedAt < CORPUS_TTL_MS) return corpusCache;

  const res = await fetch(CORPUS_URL, { cf: { cacheTtl: 900 } });
  if (!res.ok) {
    // A refresh failing is not a reason to lose a corpus we already have.
    if (corpusCache) return corpusCache;
    throw new Error('corpus ' + res.status);
  }

  corpusCache = await res.json();
  corpusFetchedAt = Date.now();
  dfCache = null;
  return corpusCache;
}

/* ---------- semantic retrieval ------------------------------------------- */

/* MEANING, not word overlap — and the difference was measured before it was
   built. Across 17 real questions, the rank of the section that actually
   answers them:

       keyword   worst rank 18   ("how do I label lot areas" -> ALAB)
       semantic  worst rank 3

   Keyword scoring fails on this site in a specific way: "label", "lot" and
   "area" appear on nearly every page of a drafting site, so they carry almost
   no weight, and the one distinctive token — ALAB — is exactly what the person
   asking does not know yet.

   NOT hybrid, which is what I expected to build. Blending the keyword score
   back in made it WORSE at every weight tried (0.15 -> worst rank 4, 0.35 ->
   5), because it drags good semantic matches down. And the case keyword was
   supposed to win — someone typing a bare command name like DIMDATA — ranks 1
   under semantic too. There was nothing left for it to add.

   Keyword survives only as the FALLBACK below, for when the vectors are stale
   or the embedding call fails. */
const VECTORS_URL =
  'https://agabanto.github.io/bw-drafting-docs/assets/data/corpus-vectors.json';

let vecCache = null;
let vecFetchedAt = 0;

/* Must match fingerprint() in scripts/gen_vectors.py exactly: url, NUL, the
   character count of the text, NUL, then the first 16 hex of the SHA-256.
   [...s].length rather than s.length because Python counts code points and
   JavaScript counts UTF-16 units, and they disagree the moment anyone puts an
   emoji in a heading. */
async function corpusFingerprint(corpus) {
  const enc = new TextEncoder();
  const parts = [];
  for (const d of corpus) {
    parts.push(enc.encode(d.u), Uint8Array.of(0),
               enc.encode(String([...d.x].length)), Uint8Array.of(0));
  }
  const buf = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { buf.set(p, at); at += p.length; }
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return [...hash].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}

/* The vectors, checked against the corpus they claim to describe. A mismatch
   means somebody regenerated the corpus without re-running gen_vectors.py, and
   the vectors now point at the wrong sections — which would quietly answer
   every question from whatever used to be at that index. Refuse them and say
   so loudly; keyword retrieval still works. */
async function getVectors(corpus) {
  if (vecCache && Date.now() - vecFetchedAt < CORPUS_TTL_MS) return vecCache;

  const res = await fetch(VECTORS_URL, { cf: { cacheTtl: 900 } });
  if (!res.ok) {
    if (vecCache) return vecCache;
    throw new Error('vectors ' + res.status);
  }
  const data = await res.json();

  if (data.v.length !== corpus.length) {
    throw new Error('vectors describe ' + data.v.length + ' sections, corpus has ' + corpus.length);
  }
  const want = await corpusFingerprint(corpus);
  if (data.fingerprint !== want) {
    throw new Error('STALE VECTORS: built for corpus ' + data.fingerprint + ', live corpus is ' +
                    want + ' — re-run scripts/gen_vectors.py');
  }

  vecCache = { dims: data.dims, rows: data.v.map(decodeVector) };
  vecFetchedAt = Date.now();
  return vecCache;
}

function decodeVector(b64) {
  const bin = atob(b64);
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
}

/* One embedding per question. RETRIEVAL_QUERY, not RETRIEVAL_DOCUMENT — the
   model embeds a question and the passage that answers it differently on
   purpose, and using the wrong one throws away most of the benefit. */
async function embedQuery(text, dims, env) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.API_KEY },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 4000) }] },
        taskType: 'RETRIEVAL_QUERY',
        outputDimensionality: dims
      })
    });
  if (!res.ok) throw new Error('embed ' + res.status + ' ' + (await res.text()).slice(0, 160));

  const v = (await res.json())?.embedding?.values;
  if (!v || !v.length) throw new Error('embed returned no vector');

  const norm = Math.hypot(...v) || 1;
  return v.map(x => x / norm);
}

/* Cosine similarity, as a plain dot product: the document vectors were unit-
   normalised before quantising and the query is normalised above, so the
   magnitudes are already gone. The int8 values are never divided by 127 —
   that is the same constant on every row and ranking does not care. */
function rankBySimilarity(qv, rows, corpus, limit, page) {
  /* Being on the reader's current page is a NUDGE, not a free pass. It used to
     be a hard prepend of every section of that page, which was harmless while
     SECTIONS was 40 and actively broken at 12: the cadastre page has exactly 12
     sections, so it filled the entire budget and displaced every retrieval
     result — ALAB never reached the model at all. The command-line page has 39,
     which would have been worse.

     As a bonus instead, a relevant section of the current page rises and an
     irrelevant one does not crowd out the section that actually answers the
     question. The size is chosen to break ties and lose arguments: cosine
     scores here separate by much more than 0.04 when a section genuinely
     matches. */
  const HERE_BONUS = 0.04;
  const HERE_MAX = 4;         // how many of the page's sections may be boosted
  const scale = 1 / 127;      // int8 -> unit, so the bonus is in cosine units

  const scored = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let s = 0;
    for (let j = 0; j < qv.length; j++) s += qv[j] * r[j];
    scored[i] = { d: corpus[i], s: s * scale, here: !!page && samePage(corpus[i].u, page) };
  }

  /* Only the page's BEST few get the nudge, and this cap is the whole reason
     the fix works. A bonus on every section of the current page is fine on a
     small page and ruinous on a big one: the cadastre page has exactly 12
     sections against a budget of 12, so boosting all of them pushed ALAB —
     living on another page, and the actual answer — out of the list entirely.
     Measured, not theorised: with the cap it comes back. */
  scored.filter(x => x.here)
        .sort((a, b) => b.s - a.s)
        .slice(0, HERE_MAX)
        .forEach(x => { x.s += HERE_BONUS; });

  scored.sort((a, b) => b.s - a.s);
  return scored.slice(0, limit).map(x => x.d);
}

/* How many sections keyword search needs to be trusted. SECTIONS is 12 because
   SEMANTIC ranks the answering section worst-case 3rd; keyword ranks it
   worst-case 18th, so running the fallback at 12 would starve it in exactly
   the mode it is worst at. Falling back widens the net back to what keyword
   always needed. */
const KEYWORD_SECTIONS = 40;

/* Semantic first, keyword if anything at all goes wrong. Every failure here is
   recoverable — stale vectors, a 429 on the embedding call, the file missing
   entirely — and none of them should cost the reader an answer.

   Returns the limit it actually used as well as the sections, because the
   caller trims the list again after promoting the current page and would
   otherwise cut the widened fallback straight back down to 12.

   NOTE there is deliberately no second embedding model here. gemini-embedding-1
   exists with its own 1,000/day, but the corpus vectors were built with
   embedding-2 and the two live in unrelated coordinate spaces — comparing a
   query from one against documents from the other returns essentially random
   sections while looking like it worked. A real embedding fallback needs a
   second corpus vector file, not a second model name. Keyword is the honest
   fallback. */
async function retrieve(query, corpus, limit, env, page) {
  try {
    const vecs = await getVectors(corpus);
    const qv = await embedQuery(query, vecs.dims, env);
    return { docs: rankBySimilarity(qv, vecs.rows, corpus, limit, page), limit, here: true };
  } catch (e) {
    console.error('semantic retrieval unavailable, falling back to keyword:',
                  e && (e.message || e));
    const wide = Math.max(limit, KEYWORD_SECTIONS);
    return { docs: search(query, corpus, wide), limit: wide };
  }
}

/* ---------- keyword retrieval (the fallback) ------------------------------ */

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
