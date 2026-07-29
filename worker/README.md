# Assistant endpoint

The Worker takes a question, finds the documentation sections that best match
it, asks a model to answer **from those sections only**, and returns the answer
with links. It holds no state and stores nothing.

It runs on **Workers AI** — Cloudflare's own models, on the same platform as
this Worker. So there is **no API key, no second vendor and no separate bill**.

---

## Deploying it

You need a Cloudflare account (free) and Node.js, because `wrangler` is a Node
tool. Nothing else — no API key, no card.

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

A small open model is the one real compromise in this setup. It is very good at
*"find the relevant passage and rewrite it as a sentence"*, which is most of
this job, and weaker at questions phrased far from the documentation's own
wording. Two dials, in the order worth trying:

1. **`SECTIONS` in `wrangler.toml`** (currently 40). If the model has the room,
   more sections means the right one is less likely to be missed. This is the
   most common cause of a bad answer — not the model, but the model never being
   shown the paragraph.
2. **`MODEL`** — try a larger one from the Workers AI catalogue. Same binding,
   no other change.

If neither is enough, switching to a paid provider is a `wrangler.toml` edit and
one secret:

```
# in [vars]
PROVIDER = "openai-compatible"
MODEL    = "gpt-4o-mini"                     # or a Groq model
BASE_URL = "https://api.openai.com/v1"       # Groq: https://api.groq.com/openai/v1
SECTIONS = 0                                 # big context: send the whole corpus
```

```
wrangler secret put API_KEY
wrangler deploy
```

`SECTIONS = 0` sends the entire corpus, which is what a large-context model
should get — retrieval only exists here to fit a small window. Google Gemini is
also an option but does **not** speak the OpenAI wire format, so it needs a
third branch in `askModel()` rather than just a different `BASE_URL`.

---

## The voice

The system prompt in `askModel()` is in three parts, and the split is the point:
**the rules bind, the voice decorates.** Command names, layer names and numbers
come straight from the documentation; the personality lives only in the sentence
around them. Being funny is never a licence to be vague.

Tuning it is a prompt edit and `wrangler deploy`. Two things learned doing it:

- **Examples beat adjectives.** "Be charming" produced nothing; a FLAT/RIGHT pair
  for the same answer produced the voice immediately.
- **Put the rules that keep slipping at the END.** The middle of a long prompt
  gets skimmed. The closing "check before you send" list is there because
  banning `"To label lot areas, ..."` in the middle simply did not take.

**A limit worth knowing:** each question is a fresh request with no memory of the
last one, so the model always reaches for its highest-probability opening. Expect
`"X is the command you want"` to recur across answers no matter how firmly the
prompt asks for variety — it cannot see what it said to the previous person. It
reads fine one answer at a time, which is how anyone actually meets it. Only a
stronger model really moves this.

**Temperature is 0.5**, up from 0.2. A voice needs room to phrase things
differently, and the facts are pinned by the supplied sections rather than by
sampling. Higher than 0.5 and the flourishes start reaching for detail the
documentation never gave it.

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

The model is instructed to answer only from the supplied documentation and to
reply `NOT_IN_DOCS` when it cannot — which the Worker turns into a plain "I can
only answer from the tool documentation" and, deliberately, no source links.
A confidently invented command name is worse than no answer, because a drafter
will go and type it.
