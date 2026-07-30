"""Embed the corpus so the assistant can retrieve by MEANING, not word overlap.

WHY THIS EXISTS
Keyword scoring fails on this site in a specific, repeatable way. Ask "how do I
label lot areas" and the ALAB section ranks EIGHTEENTH, because "label", "lot"
and "area" appear on nearly every page of a drafting site and so carry almost no
weight, while the one distinctive token - ALAB - is the very thing the person
asking does not know yet. Embeddings compare meaning instead, so the question
and "labels each selected lot with its area" land next to each other despite
sharing no rare words. Measured over 17 real questions: keyword worst rank 18,
semantic worst rank 3.

RUN after gen_corpus.py, whenever page content changes:
    python scripts/gen_vectors.py
or, better, scripts/rebuild.ps1 which runs both in order.

IT ONLY EMBEDS WHAT CHANGED, and that matters more than it sounds. The free tier
allows 1,000 EMBEDDING REQUESTS PER DAY, and batchEmbedContents counts every
item in the batch as its own request - so a full rebuild of ~285 sections costs
285 of them, and that allowance is shared with every question anybody asks the
assistant. Three rebuilds in an afternoon is most of a day's budget gone, which
is exactly how it was discovered.

So each vector is stored beside a hash of the text it was built from. Anything
unchanged is reused for free; only new or edited sections are sent. A typical
docs edit touches two or three sections and costs two or three requests instead
of 285.

STALENESS IS THE REAL RISK, so it is guarded rather than trusted. The output
carries a fingerprint of the corpus it was built from; the Worker checks it and
falls back to keyword-only if they disagree. Forgetting this script degrades
retrieval loudly in the logs rather than silently in the answers.
"""

import base64
import hashlib
import io
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CORPUS = ROOT / "assets" / "data" / "corpus.json"
OUT = ROOT / "assets" / "data" / "corpus-vectors.json"

MODEL = "gemini-embedding-2"
DIMS = 768          # 3072 is the default; 768 truncates well and is 4x smaller
BATCH = 50          # HTTP payload size only - the daily quota counts ITEMS
ENDPOINT = ("https://generativelanguage.googleapis.com/v1beta/models/"
            "%s:batchEmbedContents" % MODEL)


def ssl_context():
    """A context that can actually verify Google's certificate.

    Python builds bundled with other applications often have no trust store
    wired in - Inkscape's ships certifi but does not point OpenSSL at it, so
    every HTTPS call dies with CERTIFICATE_VERIFY_FAILED. Use certifi when it
    is there, fall back to the system store otherwise, and never disable
    verification: this call carries an API key.
    """
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def api_key():
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        sys.exit("Set GEMINI_API_KEY first:\n"
                 '  $env:GEMINI_API_KEY = "your-key"   (PowerShell)\n'
                 "The key is never written to this repo.")
    return key


def post(payload, key):
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST")
    with urllib.request.urlopen(req, timeout=180, context=ssl_context()) as r:
        return json.loads(r.read().decode("utf-8"))


def embed_batch(texts, key):
    """One batch of documents -> one vector each, in order."""
    payload = {"requests": [{
        "model": "models/" + MODEL,
        "content": {"parts": [{"text": t}]},
        "taskType": "RETRIEVAL_DOCUMENT",
        "outputDimensionality": DIMS,
    } for t in texts]}

    for attempt in range(3):
        try:
            return [e["values"] for e in post(payload, key)["embeddings"]]
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            if e.code == 429 and attempt < 2 and "PerMinute" in body:
                print("  per-minute limit, waiting 60s")
                time.sleep(60)
                continue
            if e.code == 429:
                sys.exit(
                    "\nOUT OF EMBEDDING QUOTA for today (1,000 requests, one per\n"
                    "section embedded, shared with every question asked of the\n"
                    "assistant). Nothing has been written, so the corpus and the\n"
                    "existing vectors are still a matched pair.\n\n"
                    "Check what is left at https://aistudio.google.com/rate-limit\n"
                    "and run this again after the daily reset.")
            sys.exit("Embedding failed (HTTP %d): %s" % (e.code, body[:300]))
    sys.exit("Embedding failed: still rate limited after 3 attempts")


def quantise(vec):
    """Unit-normalise, then pack to int8.

    Ranking only cares about the ANGLE between vectors, so normalising first
    turns the comparison into a plain dot product and lets 8 bits per dimension
    carry it. That is 4 bytes down to 1: the file goes from ~2 MB of JSON floats
    to ~290 KB of base64, which matters because the Worker fetches it on every
    cold start.
    """
    norm = sum(v * v for v in vec) ** 0.5 or 1.0
    return bytes((max(-127, min(127, int(round(v / norm * 127)))) & 0xFF)
                 for v in vec)


def text_hash(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def fingerprint(docs):
    h = hashlib.sha256()
    for d in docs:
        h.update(d["u"].encode("utf-8"))
        h.update(b"\x00")
        h.update(str(len(d["x"])).encode("ascii"))
        h.update(b"\x00")
    return h.hexdigest()[:16]


def previous():
    """Whatever the last run produced, as {text hash: base64 vector}.

    Only reusable if it came from the SAME model at the SAME dimensionality -
    vectors from a different model live in an unrelated coordinate space, and
    mixing them would silently rank against nonsense.
    """
    if not OUT.exists():
        return {}
    try:
        old = json.load(io.open(OUT, encoding="utf-8"))
    except Exception:
        return {}
    if old.get("model") != MODEL or old.get("dims") != DIMS:
        print("  previous vectors are from a different model/size - re-embedding all")
        return {}
    return dict(zip(old.get("h", []), old.get("v", [])))


def main():
    if not CORPUS.exists():
        sys.exit("No corpus.json - run scripts/gen_corpus.py first.")

    docs = json.load(io.open(CORPUS, encoding="utf-8"))

    # Heading first: it is the most concentrated statement of what a section is
    # about, and for a command page it carries the command name.
    texts = [((d.get("h") or d.get("t") or "") + "\n" + d["x"])[:6000] for d in docs]
    hashes = [text_hash(t) for t in texts]

    cache = previous()
    todo = sorted({h for h in hashes if h not in cache})
    reused = len(hashes) - len([h for h in hashes if h not in cache])

    print("%d sections: %d unchanged, %d to embed" % (len(texts), reused, len(todo)))
    if todo:
        key = api_key()
        by_hash = {}
        for h, t in zip(hashes, texts):
            by_hash.setdefault(h, t)

        fresh = [by_hash[h] for h in todo]
        for i in range(0, len(fresh), BATCH):
            chunk = fresh[i:i + BATCH]
            print("  embedding %d-%d of %d..." % (i + 1, i + len(chunk), len(fresh)))
            for h, vec in zip(todo[i:i + BATCH], embed_batch(chunk, key)):
                cache[h] = base64.b64encode(quantise(vec)).decode("ascii")

    payload = {
        "model": MODEL,
        "dims": DIMS,
        # Ties this file to the exact corpus it was built from. The Worker
        # compares it and falls back to keyword search if they differ, so a
        # forgotten re-run degrades loudly instead of silently mismatching
        # every question to the wrong section.
        "fingerprint": fingerprint(docs),
        # Per-section text hashes, in corpus order. These are what make the next
        # run cheap: anything whose text is unchanged is reused rather than
        # re-embedded.
        "h": hashes,
        "v": [cache[h] for h in hashes],
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps(payload, separators=(",", ":")))

    print("\n%d vectors x %d dims -> %s" % (len(hashes), DIMS, OUT.relative_to(ROOT)))
    print("  %.0f KB on disk, fingerprint %s" %
          (OUT.stat().st_size / 1024, payload["fingerprint"]))
    print("  %d embedding request(s) used of the 1,000/day allowance" % len(todo))


if __name__ == "__main__":
    main()
