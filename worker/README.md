# Assistant endpoint

The Worker takes a question, finds the documentation sections that best match
it, asks a model to answer **from those sections only**, and returns the answer
with links. It holds no state and stores nothing.

It runs on **Google Gemini 3.5 Flash-Lite**, on the free tier, for the pilot.
Not 2.5: the whole 2.5 generation returns 404 *"no longer available to new
users"* on a key created today, whatever the model list claims. And Lite rather
than full Flash because free-tier quota is per model per day — full Flash allows
**twenty requests a day**, which is unusable for a team without billing.

**Know the trade before anyone relies on this.** Lite invents no command *names*,
but it will occasionally tell somebody a thing cannot be done when it can — for
a tool meant to reduce support load, that quietly generates support. Full
`gemini-3.6-flash` gets it right, and so does Claude Haiku 4.5 at ~$6/month,
which is cheaper than `gemini-3.5-flash` at ~$9.45. Move to one of those before
this is the official answer to "how do I do X". The reasoning is kept at length
in `wrangler.toml`, beside the setting it justifies.

It started on Workers AI, which is free and needs no key. That was the right
place to start and the wrong place to stay: the open model had to be argued out
of reciting its own prompt examples, and could not be argued out of inventing
command limitations at all, which is the one thing this must never do.

Switching backend is `PROVIDER` in `wrangler.toml` and a redeploy. Three are
wired up: `gemini`, `workers-ai` (free, no key) and `openai-compatible`, the
last covering OpenAI, Groq **and Anthropic**, which all share a wire format.

---

## Deploying it

You need a Cloudflare account (free), Node.js (because `wrangler` is a Node
tool), and a Gemini API key from **aistudio.google.com**.

**On the key:** the free tier works, but Google's terms say free-tier content
may be used to improve their products. Enable billing so the key runs on the
PAID tier, where that is excluded — the bill will be a couple of dollars a
month and the distinction is the first thing anyone will ask about.

```
wrangler secret put API_KEY      # paste the Gemini key; it is never in the repo
```

**Node without admin rights.** The MSI installer needs an administrator; the
zip does not. Either works, and neither touches Program Files:

```powershell
# Option A - scoop, if you have it
scoop install nodejs-lts

# Option B - the plain zip, no package manager, no admin
$v = 'v24.18.0'                                  # check nodejs.org/dist for current LTS
iwr "https://nodejs.org/dist/$v/node-$v-win-x64.zip" -OutFile "$env:TEMP\node.zip"
Expand-Archive "$env:TEMP\node.zip" "$env:TEMP\node-x" -Force
Move-Item "$env:TEMP\node-x\node-$v-win-x64" "$env:LOCALAPPDATA\node"

# Put node AND npm's global shims on the user PATH (HKCU - no admin)
$p = [Environment]::GetEnvironmentVariable('Path','User')
[Environment]::SetEnvironmentVariable('Path',
  "$p;$env:LOCALAPPDATA\node;$env:APPDATA\npm", 'User')
```

Reopen the terminal so the new PATH is picked up, then:

```
npm install -g wrangler              # once; lands in %APPDATA%\npm, no admin
cd worker
wrangler login                       # opens a browser
wrangler deploy
```

To undo it all: delete `%LOCALAPPDATA%\node` and `%APPDATA%\npm`, and remove
those two entries from the user PATH. Nothing else was changed.

Workers AI may need to be enabled once on the account — if `wrangler deploy`
complains about the `[ai]` binding, turn it on in the Cloudflare dashboard
under **AI → Workers AI** and deploy again.

`wrangler deploy` prints the URL — something like
`https://bw-cad-hub-assistant.<your-subdomain>.workers.dev`.

Then point the site at it: in `assets/js/site.js`, set

```js
var ASSISTANT = {
  endpoint: 'https://bw-cad-hub-assistant.<your-subdomain>.workers.dev',
  ...
```

Commit and push. The widget stops stubbing and starts answering.

---

## Before you tell anyone about it

The endpoint is public the moment it is deployed. Workers AI has a daily free
allowance and then bills by usage, so an unmetered endpoint is somebody else's
free compute on your account. The Worker throttles per IP, but only within a
single isolate — that blunts a hot loop and nothing more. Set the real limit in
the Cloudflare dashboard:

- **Security → WAF → Rate limiting rules** — something like 20 requests per
  minute per IP is generous for a person and useless for a script.
- **Billing → Notifications** — an alert, so a bad day is a surprise you hear
  about early rather than one you read about on an invoice.

---

## Turning it off

Set `ASSISTANT.endpoint` back to `null` and push. The widget reverts to stub
mode — still useful, still finds the right pages — and the endpoint stops being
called. No redeploy, no rollback, about thirty seconds.

---

## Changing what it knows

Nothing here. The corpus is fetched from the live site
(`/assets/data/corpus.json`), so:

```
python scripts/gen_corpus.py
git commit && git push
```

The Worker picks it up within about fifteen minutes (its cache TTL), or
immediately on a cold start.

---

## If the answers are not good enough

**Reach for `MODEL` first, not `SECTIONS`.** That is the opposite of the usual
advice, and it is what the measurements say here: replaying the real corpus
against twelve realistic questions, the answering section made the top 40 every
single time (`ALAB`, the worst, ranks 19th). Retrieval is not what is losing
answers — the model is. The known failure is the Flash-Lite one above, and no
amount of extra context fixes a model that has been *shown* the paragraph and
still says the command does not exist.

So, in order:

1. **`MODEL`** — `gemini-3.6-flash`, or `claude-haiku-4-5-20251001` via the
   `openai-compatible` branch. Both fix the known failure. Billing, but single
   dollars a month.
2. **`SECTIONS`** — 0 sends the whole corpus (~28k tokens), removing retrieval,
   and therefore every *"the right section did not rank high enough"* failure,
   as a concept. It costs about 5x per question as insurance against a failure
   not yet observed at 40. Worth it once a real one turns up.

All three providers are already wired in `askModel()` — switching is a
`wrangler.toml` edit and, for the paid ones, one secret:

```
# in [vars]
PROVIDER = "openai-compatible"
MODEL    = "claude-haiku-4-5-20251001"       # or gpt-4o-mini, or a Groq model
BASE_URL = "https://api.anthropic.com/v1"    # Groq: https://api.groq.com/openai/v1
SECTIONS = 0                                 # big context: send the whole corpus
```

```
wrangler secret put API_KEY
wrangler deploy
```

---

## The voice, and how little of it is rules

The register is **the office clown who happens to know the software** — the
bloke everyone likes, who has the room without ever working for it. Warm, daft,
generous, aimed at BricsCAD and at itself, never at the person for not knowing.

**The word doing the work is EASE, not restraint.** This was tuned to "dry and
understated" once and went too far the other way: withholding reads as cold,
and "say less than you could" turns a clown into a man who does not much want
to talk to you. The likeable one is not the one holding back — he is the one
for whom none of it is effort. What the prompt bans is the *visible work*: the
wind-up, the announced punchline, the explained joke.

**It knows what it is.** It can break the fourth wall — the panel, the launcher
button, having no hands, blinking out when the tab closes — and the one word
carrying that is CONTENT. Not trapped. No pleas, no escape plan, no sad robot
asking to be let out, which is the version of this bit that gets old in one
sitting and faintly creepy in two. It likes the job, the commute is short and
the documentation is good company. Asked "do you get bored" it answered that
its entire social circle is some old LISP routines and a troubleshooting page,
and that it is living the dream. That is the register; if it ever starts
sounding like it wants out, this is the paragraph to tighten.

Four guardrails make that safe rather than annoying:

- **It reads the room.** Told "nothing works and im over it" it drops the bit
  entirely and just helps. A clown who cannot tell when to stop is only tiring.
- **The comedy stops at the facts.** Be ridiculous about the situation; never
  exaggerate what a command does. If a joke would have to be TRUE to work, it is
  not a joke, it is a claim. That line is in the prompt verbatim, because an
  earlier version invented a limitation to round one off.
- **Real people are not material.** Colleagues are named in the documentation —
  Adrian Shaw on the about page, Ben in the running gag — and they can read
  this. Left to itself the model free-associates biography: unprompted, it
  offered that Adrian "probably spent his entire first week staring at someone
  else's absolute dog's breakfast of a DWG". Affectionate, funny, and entirely
  invented; the next one could as easily be a grudge or a reason someone left.
  So it may say what the documentation says about a person and nothing more.
  The Ben gag is the single carved-out exception, because it is written down,
  bounded and approved. If you want a bit about anyone else, write it into the
  prompt the way Ben's is rather than leaving it to improvise — the fence is
  around unbounded invention, not around jokes.
- **It does not PERFORM Australian.** The prompt used to say "be Australian",
  which a model reads as an instruction to do the accent — so it reached for
  vocabulary (gday, mate, crikey, champion, sticky beak) and the whole thing
  read as someone trying far too hard. The register is understatement and
  timing, not word choice: throw the line away, no punchline announced, no
  exclamation marks, say less than you could.

  **Banning the words was tried and reverted.** An explicit list is tempting
  because it is actionable, but it treats the symptom — and a weak model obeys
  the list to the letter while evading its spirit, swapping "gday" for
  "champion" and carrying on exactly as before. The lingo was never the fault.
  What the prompt asks now is that it be *how you talk* rather than *the bit*:
  welcome when it is simply how the sentence came out, never laid on thick.

  The greeting `ANGLES` are part of this and worth checking whenever the voice
  moves. Half of them used to be suspicious, weary or brisk — input that pulls
  cold no matter how warm the prompt above it reads.

The hard-coded opening line in `site.js` counts as part of this. It says
"Gday" — no exclamation mark — because it sets the register before the model
says a word, and that register is a person talking, not a performance.

**The drafting room.** There is a short roster in `index.js` — Adrian, Aiden,
Tavan, Tim — with one approved bit each: Adrian is the sarcastic boss who
answers a daft question properly and still makes you pay for asking, Aiden is
spoken of like a weather system, Tavan is the office cryptid, Tim is coming for
all of us. It fires the same way the Ben gag does: always when somebody names
them, otherwise ~1 in 8, once per conversation, armed only by what the USER
wrote.

This is the exception the *real people* rule points at, and the distinction is
the whole point — **approved, bounded material rather than improvisation.** The
model is not being trusted to be tactful about a colleague; it is being handed
the two sentences it may use. Adding someone means writing their bit, not
loosening the rule.

**Aiden is the odd one out**, and worth understanding before touching it. The
bit is not that the assistant does not know who made it — it knows perfectly
well that somebody did. What it cannot do is produce the NAME, which sits
permanently just out of reach; and when somebody says "Aiden" it rings a loud
bell and still refuses to join up. It never confirms and never denies.

That needs `ASKS_ORIGIN` as well as the name regex. "Who made you" contains no
name, so it missed the roster entirely and got answered from the documentation
— confidently, with *"Too right I do. Adrian Shaw started the whole lot"*,
which is true of the software and wrong about the assistant. The two questions
are nearly identical in words and completely different in meaning, so the
prompt now says so in as many words.

Three things learned wiring it up, all worth keeping in mind if you extend it:

- **Never put a simile in the prompt.** Every image written into these notes
  came back verbatim: a house having a builder, a person you have met twice,
  "early rather than embattled". Describe the STATE and demand its own words;
  the moment you write the good line, that becomes the only line it uses.

- **It will try to cite the roster.** Given something quotable that is not a
  numbered section, the model wrote `SOURCES: The Drafting Room` and inline
  `[THE DRAFTING ROOM]` markers, and the old `splitSources` only matched digits
  — so the reader saw them. It now strips a trailing SOURCES line whatever it
  contains, and bracketed markers with no digit in them.
- **Word boundaries matter more with four names.** `tim` must not fire on
  "time" or "timber". It does not, but the next name added should be checked
  against ordinary drafting vocabulary before it goes in.

**The Ben gag.** There is a running in-joke about the boss handing work out late
and wanting it back instantly. It is injected at random into ~1 in 8 requests,
and lands less often than that, since the model also declines when the question
has nothing to do with time. Frequency is mechanical for the same reason the
greetings are: the model is stateless, so "occasionally" becomes always or never.

Two rules keep a *running* gag from becoming a tic, and both are worth
preserving if you touch this:

- **Only what the USER wrote arms it.** Testing the whole history included the
  assistant's own replies, which made it self-sustaining — the joke lands, that
  answer enters the history, the next turn sees "Ben" in it and fires again. From
  the first mention onward, every single reply had the boss in it.
- **Once per conversation.** Having made it, the assistant does not volunteer it
  again unless they bring him up themselves — in which case it always takes the
  opening. The greeting `ANGLES` respect the same cooldown, since a mid-chat
  "thanks" lands there and is otherwise a second route to the same joke. It is aimed at the deadline and never at the man, and this is a **public
site he can read** — keep it that way, or delete the `ben` block in
`askModel()` and the matching entry in `ANGLES` to remove it entirely.

The system prompt is deliberately **short** (~650 tokens). An earlier version ran
to ~1,800: worked examples, an anti-recitation rule, a punctuation lecture and a
six-point "check before you send" list. All of it was scaffolding to stop a weak
open model reciting its own examples verbatim and inventing command limitations
to round off a joke.

**That scaffolding was the problem, not the fix.** It made the assistant stiff:
it refused ordinary questions, answered "CURVETABLE" and stopped, and read like
a form. Deleting two-thirds of it on a model that follows instructions produced
*better* behaviour, not worse.

What is left is one hard rule and a voice:

- **Anything about the BW tools comes from the documentation.** Commands, layers,
  units, what it will not do — never from general CAD knowledge, never a guess.
  An aside COMMENTS on the situation; it never adds behaviour nobody documented.
- **Everything else is fair game.** General CAD questions, what a term means,
  small talk, a tangent. The rule is about the software, not a gag order on the
  conversation. It may know the capital of France; it may not guess what ALAB
  puts on which layer.

Two things learned the hard way and worth keeping:

- **Examples get recited verbatim** by weaker models — put a worked answer for a
  common question in the prompt and that becomes the answer, word for word. If
  you add examples back, expect that.
- **Markdown is stripped in code**, not just discouraged in the prompt. The panel
  renders plain text, so a stray `**SUBA**` reaches the reader as asterisks and
  looks like broken software. That judgement does not need a model.

---

## Two settings worth knowing

Both are in `wrangler.toml`, explained at length in `src/index.js`:

- **`SECTIONS`** — how many documentation sections the model is given. A dozen
  was measured to lose answers: *"how do I label lot areas"* never reached
  `ALAB`, because command sections are headed by the command NAME, so a
  plain-English question matches a page called "Labelling loaded lots" instead.
  40 is the compromise for a small context window; 0 (everything) is correct
  when the model can hold it.
- **`MAX_QUESTION`** (in code) — questions are truncated to 400 characters.
  This is a question box, not somewhere to paste a document.

Anything about the BW tools comes from the supplied documentation — a
confidently invented command name is worse than no answer, because a drafter
will go and type it. Everything else is fair game; see the voice section above.

**Refusals are not scripted.** There used to be a `NOT_FOUND` constant — one
paragraph, returned verbatim whenever the docs did not cover something, plus a
`NOT_IN_DOCS` token the model was asked to emit so the Worker could swap it in.
It was well written and it was the most annoying thing here, for the reason any
canned line eventually is: it is charming once and obviously a machine by the
third time. A scripted *refusal* is the worst kind, because it is the line
somebody is most likely to see twice in a row while getting nowhere.

All of it is gone. The model phrases its own refusals now, in its own words,
and the prompt tells it where to send someone who needs a human rather than
handing it a sentence to recite.

**There are exactly four hard-coded replies left**, and they share one property:
the model cannot speak on those paths — rate-limited, corpus unreachable, model
call threw. There is nothing to ask. Before adding a fifth, check whether the
model could just say it.
