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

The register is **the office clown who happens to know the software** — dry,
unbothered, aimed at BricsCAD and at itself, never at the person for not
knowing. Three guardrails make that safe rather than annoying:

- **It reads the room.** Told "nothing works and im over it" it drops the bit
  entirely and just helps. A clown who cannot tell when to stop is only tiring.
- **The comedy stops at the facts.** Be ridiculous about the situation; never
  exaggerate what a command does. If a joke would have to be TRUE to work, it is
  not a joke, it is a claim. That line is in the prompt verbatim, because an
  earlier version invented a limitation to round one off.
- **It does not perform Australian.** The prompt used to say "be Australian",
  which a model reads as an instruction to do the accent — so it reached for
  vocabulary (gday, mate, crikey) and the whole thing read as someone trying
  too hard. The register is understatement and timing, not word choice, and
  that is now what the prompt asks for: throw the line away, no punchline
  announced, no exclamation marks, say less than you could. The banned words
  are listed explicitly, because "do not overdo it" is not actionable and a
  short list is.

The hard-coded opening line in `site.js` counts as part of this. It used to
start "Gday", which set the register before the model said a word and invited
it to keep performing.

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

The Worker still catches a literal `NOT_IN_DOCS` in the opening words and
replaces it with a plain sentence and no source links. The short prompt no
longer *asks* for that token, so this is now a guard rather than a protocol:
if some future model emits it, the reader must not be shown the raw string.
