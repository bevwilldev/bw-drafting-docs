# Assistant endpoint

The one piece of the assistant that cannot live in the browser: an API key.
Everything else — the corpus, the widget, the retrieval — is in the site itself.

The Worker takes a question, finds the documentation sections that best match
it, asks a model to answer **from those sections only**, and returns the answer
with links. It holds no state and stores nothing.

---

## Deploying it

You need a Cloudflare account (free) and an OpenAI API key.

```
npm install -g wrangler          # once
cd worker
wrangler login                   # opens a browser
wrangler secret put OPENAI_API_KEY
wrangler deploy
```

`wrangler deploy` prints the URL — something like
`https://bw-cad-hub-assistant.<your-subdomain>.workers.dev`.

Then point the site at it: in `assets/js/site.js`, set

```js
var ASSISTANT = {
  endpoint: 'https://bw-cad-hub-assistant.<your-subdomain>.workers.dev',
  ...
```

Commit and push. The widget stops stubbing and starts answering.

**The key never touches the repo.** `wrangler secret put` stores it with
Cloudflare; the Worker reads it from the environment at runtime.

---

## Before you tell anyone about it

The endpoint is public the moment it is deployed, and an unmetered one is
somebody else's free API. The Worker throttles per IP, but only within a single
isolate — that blunts a hot loop and nothing more. Set the real limit in the
Cloudflare dashboard:

- **Security → WAF → Rate limiting rules** — something like 20 requests per
  minute per IP is generous for a person and useless for a script.
- **Billing → Notifications** on the OpenAI account: a monthly cap and an alert.
  This is the backstop that turns a bad day into a small bill.

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

## Two settings worth knowing

Both are at the top of `src/index.js`:

- **`SECTIONS`** — how many documentation sections the model is given. It is
  `0`, meaning **all of them** (~28k tokens per question), and that is
  deliberate. Cutting it to a dozen saves about 80% of the tokens and was
  measured to lose answers: *"how do I label lot areas"* never reached `ALAB`,
  because command sections are headed by the command NAME, so a plain-English
  question matches a page called "Labelling loaded lots" instead. Tuning got it
  close and never to reliable, and a wrong answer costs a drafter far more than
  the tokens. Set a number here only if the bill justifies re-opening that.
- **`MAX_QUESTION`** — questions are truncated to 400 characters. This is a
  question box, not somewhere to paste a document.

The model is instructed to answer only from the supplied documentation and to
reply `NOT_IN_DOCS` when it cannot — which the Worker turns into a plain "I can
only answer from the tool documentation" and, deliberately, no source links.
A confidently invented command name is worse than no answer, because a drafter
will go and type it.
