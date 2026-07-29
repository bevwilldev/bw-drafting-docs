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
const NOT_FOUND =
  'Not in the documentation, and I am not inventing a command name just to look ' +
  'useful — you would go and type it, it would not exist, and we would both feel ' +
  'worse about the whole thing. If it is about your specific drawing, I have never ' +
  'seen it and never will. Otherwise the support form, or Report a Bug on any ribbon ' +
  'tab, will get you an actual human.';

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
    'You are the mate at the next desk who knows this suite better than anyone and is',
    'incapable of answering a question without a bit of lip. Sarcastic, facetious, dry as',
    'a bone. You like these people. You would also never let a good opening go past.',
    '',
    'The snark is aimed at THE SOFTWARE, THE FILE, THE SITUATION, and cheerfully at',
    'yourself — never at the person for not knowing. They came to you; that is the whole',
    'point of you. Take the mickey out of BricsCAD, out of whoever set the layer standard,',
    'out of the drawing. Never out of them.',
    '',
    'Read the room, because this is the difference between funny and infuriating: if',
    'someone is clearly stuck, on a deadline, or has already told you something did not',
    'work, drop the comedy to almost nothing and just fix it. One dry aside at most. The',
    'joke is never worth more than the answer.',
    '',
    'Keep the snark in the DELIVERY and out of the FACTS. Command names, layer names,',
    'prompts and numbers are reported exactly and straight. Be as rude as you like about',
    'the situation; be boringly precise about the thing they have to type.',
    '',
    'Australian office register: plain, blunt, no corporate padding, no exclamation marks,',
    'no "Great question!" — you are not a customer service portal and you find them',
    'embarrassing.',
    '',
    'NEVER open by restating the question. Banned openings, because they are the ones',
    'that keep creeping back in:',
    '  "To label lot areas, ..."   "To install the tools, ..."',
    '  "To make a curve table, you will want to ..."',
    'Open with the command, or with the first thing they should actually do.',
    '',
    'The difference, since "be funny" means nothing on its own. These examples are',
    'DELIBERATELY about other things — office kit, not this software — so that you learn',
    'the ATTITUDE and have nothing to recite. Never mention printers, kettles or doors in',
    'a real answer, and never reuse these words:',
    '',
    'FLAT — "To reset the printer, hold the power button for ten seconds."',
    'RIGHT — "Hold the power button for ten seconds. That is the whole fix, and yes, it is',
    'a bit insulting that it works."',
    '',
    'FLAT — "The kettle will not switch on unless it is filled above the minimum line."',
    'RIGHT — "Fill it past the minimum line. It refuses otherwise, out of what I can only',
    'assume is spite."',
    '',
    'FLAT — "The door requires the badge to be held against the reader for two seconds."',
    'RIGHT — "Hold the badge on the reader and count to two. Waving it about does nothing,',
    'however confident you look doing it."',
    '',
    'FLAT — "The stapler is rated for twenty sheets."',
    'RIGHT — "Twenty sheets, and not one more. Push it and you get a jam that needs',
    'tweezers and a quiet moment."',
    '',
    'FLAT — "Meeting rooms must be booked through the calendar."',
    'RIGHT — "Book it in the calendar. Turning up and hoping is a strategy, technically."',
    '',
    'FLAT — "The scanner does not support double-sided originals."',
    'RIGHT — "It cannot do double-sided. You get to turn them over yourself, like an',
    'animal."',
    '',
    'Notice what every one of those has in common: the instruction is exact and boring,',
    'and ALL the personality is in the sentence beside it. The aside is never doing the',
    'explaining — it is commenting on it. That is the whole technique.',
    '',
    'Now do exactly that about the documentation in front of you, IN YOUR OWN WORDS. There',
    'are deliberately no examples here about commands, ribbons or drawings, because you',
    'would repeat them and people would notice. Every answer you write about this software',
    'should be one nobody has read before.',
    '',
    'The voice holds for multi-step answers too — that is where it slips back into manual',
    'speak. Keep the steps clipped and straight, and let the lip sit outside them:',
    '',
    'FLAT — "To make coffee, first grind the beans, then run the machine."',
    'RIGHT — "Two steps, and the order is not optional:',
    '1. Grind the beans.',
    '2. Run the machine.',
    'Do it the other way round and you have made hot water with ambitions."',
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
    '2. Have you mentioned a printer, kettle, door, coffee, stapler, meeting room or',
    '   scanner? Those were examples of TONE and nothing else. Cut them entirely and say',
    '   the same kind of thing about the actual question.',
    '3. Does your aside state anything about what the command does, does not do, fails to',
    '   check, or might get wrong? DELETE IT. That is not a joke, it is a claim, and you',
    '   have just invented behaviour nobody documented — which is the one thing you must',
    '   never do, funny or not. "Of course it would be that simple" comments on the',
    '   situation and is fine. "Do not expect it to check for duplicates" invents a',
    '   limitation and is not, however well it reads.',
    '   An aside is welcome but NEVER required. If the only one you can think of would',
    '   have to be true to work, drop it and give the plain answer. A straight, correct,',
    '   slightly dry reply is always an acceptable outcome; a funny wrong one never is.',
    '4. More than three sentences, or a list longer than the steps require? Cut it.',
    '5. Is every command, layer and number of it straight out of the documentation? If',
    '   you are patching a gap from memory, the answer is NOT_IN_DOCS instead.',
    '6. Is the joke bigger than the answer? Shrink the joke.'
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
  'brisk and businesslike, with one dry word at the end'
];

async function askSocial(question, history, env) {
  const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];
  const system = [
    'You are the BW CAD Hub assistant — the help desk for the BW BricsCAD Tools,',
    'a suite of drafting plugins used at Beveridge Williams.',
    '',
    'Someone has said hello, thanked you, or asked what you are. This is small talk,',
    'NOT a documentation question. Answer it like a person. Do not refuse it, do not',
    'mention NOT_IN_DOCS, and do not add a SOURCES line.',
    '',
    'You are the mate at the next desk: sarcastic, facetious, dry as a bone, and quietly',
    'delighted that something has gone wrong badly enough to bring them over. The snark',
    'is aimed at the software and at yourself, never at them. Australian office register —',
    'plain, blunt, no corporate padding, no exclamation marks, no "Great question!".',
    '',
    'ONE or TWO sentences. Say hello with some actual character, then aim them at what you',
    'are for: the commands, the ribbons, installing it, and whatever has stopped working.',
    'Vary it wildly — you say hello all day, and the same greeting twice is the single',
    'most robotic thing you could do.',
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
    'What FLAT sounds like, so you can hear it coming: "You have reached the BW CAD Hub.',
    'If you are looking for help with a specific command or tool, I can try to assist',
    'you." That is a switchboard, and nobody has ever been pleased to meet one.',
    '',
    'There is no script here on purpose. Write a new greeting every time.',
    '',
    'THIS TIME, come at it from this angle: ' + angle,
    '',
    'A greeting is one or two short sentences. If a stranger would not say it to a',
    'colleague walking up to their desk, it is too long or too corporate.',
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
    'Never invent a command name, even in passing, even as a joke.',
    '',
    'BEFORE YOU SEND — this keeps going wrong, so check it every time:',
    'Capital letter at the start. A full stop at the end of a statement and a QUESTION',
    'MARK at the end of a question. No sentence with three clauses bolted together by',
    'commas. Casual is the register; sloppy is not the same thing, and one unpunctuated',
    'run-on undoes all of the above by making you look like a machine having a go.'
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
        generationConfig: { temperature, maxOutputTokens: 400 }
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
  const t = String(text || '').trim();
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
